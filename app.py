import atexit
from flask import Flask, send_from_directory, jsonify
from flask_socketio import SocketIO
import os
from jinja2 import Environment, FileSystemLoader
from watchdog.observers import Observer
from watchdog.events import (
    FileSystemEventHandler,
    DirModifiedEvent,
    FileModifiedEvent,
)
from datetime import datetime

from test_data import TEST_DATA, load_test_data

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


@app.route("/")
def index():
    return send_from_directory("ui", "index.html")


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
    return jsonify(templates)


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


class FileChangeHandler(FileSystemEventHandler):
    def on_modified(self, event: DirModifiedEvent | FileModifiedEvent) -> None:
        if event.is_directory:
            return

        path = str(event.src_path).replace("\\", "/")

        # Handle template changes
        if path.endswith(".jinja") and "templates/" in path:
            relative_path = path.split("templates/", 1)[1]
            print(f"Template changed: {relative_path}")
            socketio.emit("template_changed", {"path": relative_path})

        # Handle UI file changes
        elif "ui/" in path and any(
            path.endswith(ext) for ext in [".html", ".js", ".css"]
        ):
            print(f"UI file changed: {path}")
            socketio.emit("ui_changed", {})

        # Handle test data TOML file changes
        elif path.endswith("test_data.toml"):
            print("Test data changed, reloading...")
            load_test_data()
            socketio.emit("test_data_changed", {})


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


if __name__ == "__main__":
    socketio.run(app, debug=True)
