import atexit
import argparse
import shutil
from datetime import datetime
import os
import threading
from flask import Flask, send_from_directory, jsonify
from flask_socketio import SocketIO
from jinja2 import Environment, FileSystemLoader
from watchdog.observers import Observer
from watchdog.events import (
    FileSystemEventHandler,
    FileModifiedEvent,
)
from pathlib import Path

from test_data import TEST_DATA, load_test_data
from template_cli import extract_template, inject_template

# Parse command line arguments
parser = argparse.ArgumentParser(description="Template editor with live preview")
parser.add_argument(
    "--config",
    "-c",
    dest="config_path",
    help="Path to tokenizer_config.json file to extract template from",
)
parser.add_argument(
    "--force",
    "-f",
    action="store_true",
    help="Force overwrite existing template file",
)
args = parser.parse_args()

app = Flask(__name__, static_folder="ui", static_url_path="/static")
socketio = SocketIO(app)

env = Environment(
    loader=FileSystemLoader("templates"),
    auto_reload=True,
    cache_size=0,  # Disable caching completely
    trim_blocks=True,
    lstrip_blocks=True,
)

DEFAULT_SYSTEM_PROMPT = "You are a helpful AI"

# Global variables for config file handling
config_path = None
extracted_template = None
config_backup_created = False
inject_timer = None
DEBOUNCE_TIME = 1.0  # Debounce time in seconds


# Initialize template from config if provided
if args.config_path:
    config_path = Path(args.config_path)
    if config_path.exists():
        try:
            import json

            with open(config_path, "r", encoding="utf-8") as f:
                config_data = json.load(f)
            model_name = config_data.get("model_type", config_path.parent.name)
            template_filename = f"{model_name}_template.jinja"
            template_path = Path("templates") / template_filename

            # Check if template file already exists
            if template_path.exists() and not args.force:
                # Create backup of existing template
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                backup_path = f"{template_path}.{timestamp}.bak"
                shutil.copy2(template_path, backup_path)
                print(f"Existing template found. Created backup at {backup_path}")

            # Extract the template after handling any existing files
            extract_result = extract_template(config_path)
            if extract_result == 0:
                extracted_template = template_filename
                print(f"Extracted template to templates/{extracted_template}")
            else:
                print(f"Failed to extract template from {config_path}")

        except Exception as e:
            print(f"Error processing config file: {e}")
    else:
        print(f"Warning: Config file {config_path} does not exist")


@app.route("/")
def index():
    return send_from_directory("ui", "index.html")


@app.route("/favicon.ico")
def favicon():
    return send_from_directory("ui", "favicon.ico")


@app.route("/api/tokens")
def get_tokens():
    return jsonify(TEST_DATA["tokens"])


@app.route("/api/test-cases")
def get_test_cases():
    return jsonify(list(TEST_DATA["test_cases"].keys()))


@app.route("/api/files")
def list_templates():
    templates = []
    for root, _, files in os.walk("templates"):
        for file in files:
            if file.endswith(".jinja"):
                path = os.path.relpath(os.path.join(root, file), "templates")
                templates.append(path.replace("\\", "/"))

    # Put the extracted template first if we have one
    if extracted_template and extracted_template in templates:
        templates.remove(extracted_template)
        templates.insert(0, extracted_template)

    return jsonify(templates)


@app.route("/api/active-template")
def get_active_template():
    """Return the extracted template path if one exists"""
    return jsonify({"active_template": extracted_template})


@socketio.on("request_render")
def handle_render_request(data):
    try:
        template = env.get_template(data["filepath"])
        errors = []

        def raise_exception(error):
            nonlocal errors
            errors.append(error)

        # Get the test case data and add the generation prompt flag
        test_case_data = TEST_DATA["test_cases"][data["test_case"]].copy()

        # Handle system prompt toggle
        if "add_system_prompt" in data and data["add_system_prompt"]:
            # Add system prompt to messages if toggle is on
            system_msg = {"role": "system", "content": DEFAULT_SYSTEM_PROMPT}
            messages = test_case_data.get("messages", []).copy()
            test_case_data["messages"] = [system_msg] + messages

        # Override add_generation_prompt with the value from the UI
        if "add_generation_prompt" in data:
            test_case_data["add_generation_prompt"] = data["add_generation_prompt"]

        rendered = template.render(
            raise_exception=raise_exception,
            **test_case_data,
            **TEST_DATA["tokens"],
            strftime_now=lambda fmt: datetime.now().strftime(fmt),
        )

        if errors:
            str_errors = f"Template raise_exception called {len(errors)} times:"
            str_errors += "\n" + "\n".join(errors)
            socketio.emit("render_update", {"content": None, "error": str_errors})
        else:
            socketio.emit("render_update", {"content": rendered, "error": None})
    except Exception as e:
        socketio.emit(
            "render_update", {"content": None, "error": f"{type(e).__name__}: {str(e)}"}
        )


def create_config_backup():
    """Create a backup of the config file with timestamp if not already done"""
    global config_backup_created

    if config_path and not config_backup_created:
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = f"{config_path}.{timestamp}.orig"
            shutil.copy2(config_path, backup_path)
            print(f"Created backup of config file at {backup_path}")
            config_backup_created = True
            return True
        except Exception as e:
            print(f"Error creating config backup: {e}")
            return False
    return False


def debounced_inject_template(template_path, config_path):
    """Inject template back to config after debounce period"""
    global inject_timer

    # Cancel previous timer if it exists
    if inject_timer:
        inject_timer.cancel()

    # Create a new timer that will execute the injection after DEBOUNCE_TIME
    def perform_injection():
        create_config_backup()
        inject_result = inject_template(template_path, config_path)
        if inject_result != 0:
            print(f"Failed to inject template to {config_path}")

    inject_timer = threading.Timer(DEBOUNCE_TIME, perform_injection)
    inject_timer.daemon = True
    inject_timer.start()


class FileChangeHandler(FileSystemEventHandler):
    def _handle_file_event(self, event, event_type):
        if event.is_directory:
            return

        path = str(event.src_path).replace("\\", "/")

        # Handle template changes
        if path.endswith(".jinja") and "templates/" in path:
            relative_path = path.split("templates/", 1)[1]
            print(f"Template {event_type}: {relative_path}")

            # If this is our extracted template and the config path exists, update the config
            if (
                config_path
                and extracted_template
                and relative_path == extracted_template
                and event_type == "modified"
            ):
                # Schedule debounced injection
                template_path = Path("templates") / extracted_template
                debounced_inject_template(template_path, config_path)

            if event_type == "modified":
                socketio.emit("template_changed", {"path": relative_path})
            elif event_type in ["created", "deleted"]:
                socketio.emit("template_list_changed", {})

        # Handle UI file changes
        elif "ui/" in path and any(
            path.endswith(ext) for ext in [".html", ".js", ".css"]
        ):
            print(f"UI file {event_type}: {path}")
            socketio.emit("ui_changed", {})

        # Handle test data TOML file changes
        elif path.endswith("test_data.toml"):
            print(f"Test data {event_type}, reloading...")
            load_test_data()
            socketio.emit("test_data_changed", {})

    def on_modified(self, event):
        self._handle_file_event(event, "modified")

    def on_created(self, event):
        self._handle_file_event(event, "created")

    def on_deleted(self, event):
        self._handle_file_event(event, "deleted")


# Set up the observer to watch templates, UI, and test_data.toml
observer = Observer()
observer.schedule(FileChangeHandler(), path="./templates", recursive=True)
observer.schedule(FileChangeHandler(), path="./ui", recursive=True)
observer.schedule(FileChangeHandler(), path=".", recursive=False)
observer.start()


@atexit.register
def stop_observer():
    observer.stop()
    observer.join()

    # Cancel any pending injection timer
    global inject_timer
    if inject_timer:
        inject_timer.cancel()


if __name__ == "__main__":
    socketio.run(app)
