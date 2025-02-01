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

from test_data import TEST_CASES, TOKENS

app = Flask(__name__, static_folder="ui", static_url_path="/static")
socketio = SocketIO(app)
env = Environment(
    loader=FileSystemLoader("templates"),
    auto_reload=True,
    cache_size=0,  # Disable caching completely
)


@app.route("/")
def index():
    return send_from_directory("ui", "index.html")


@app.route("/api/test-cases")
def get_test_cases():
    return jsonify(list(TEST_CASES.keys()))


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

        rendered = template.render(
            raise_exception=raise_exception,
            **TEST_CASES[data["test_case"]],
            **TOKENS,
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


class TemplateChangeHandler(FileSystemEventHandler):
    def on_modified(self, event: DirModifiedEvent | FileModifiedEvent) -> None:
        if event.is_directory:
            return

        path = str(event.src_path)
        if path.endswith(".jinja"):
            path = path.replace("\\", "/")
            path = path.replace("./templates/", "")
            print(f"Template changed: {path}")
            socketio.emit("template_changed", {"path": path})


observer = Observer()
observer.schedule(TemplateChangeHandler(), path="./templates", recursive=True)
observer.start()


@atexit.register
def stop_observer():
    observer.stop()
    observer.join()


if __name__ == "__main__":
    socketio.run(app, debug=True)
