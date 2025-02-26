import argparse
import json
import sys
from pathlib import Path


def extract_template(config_path, output_path=None):
    """Extract chat template from tokenizer_config.json to a separate file."""
    config_path = Path(config_path)

    if not config_path.exists():
        print(f"Error: File {config_path} does not exist", file=sys.stderr)
        return 1

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
    except json.JSONDecodeError:
        print(f"Error: {config_path} is not a valid JSON file", file=sys.stderr)
        return 1

    if "chat_template" not in config:
        print(f"Error: No chat_template found in {config_path}", file=sys.stderr)
        return 1

    template = config["chat_template"]

    if not output_path:
        # Create templates directory if it doesn't exist
        templates_dir = Path("templates")
        if not templates_dir.exists():
            templates_dir.mkdir(exist_ok=True)
        # Use model name or config filename for the template file
        model_name = config.get("model_type", config_path.parent.name)
        output_path = templates_dir / f"{model_name}_template.jinja"
    else:
        output_path = Path(output_path)

    try:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(template)
        print(f"Template extracted to {output_path}")
        return 0
    except Exception as e:
        print(f"Error writing template to file: {e}", file=sys.stderr)
        return 1


def inject_template(template_path, config_path):
    """Inject a chat template from a file into tokenizer_config.json."""
    template_path = Path(template_path)
    config_path = Path(config_path)

    if not template_path.exists():
        print(f"Error: Template file {template_path} does not exist", file=sys.stderr)
        return 1

    if not config_path.exists():
        print(f"Error: Config file {config_path} does not exist", file=sys.stderr)
        return 1

    try:
        with open(template_path, "r", encoding="utf-8") as f:
            template = f.read()
    except Exception as e:
        print(f"Error reading template file: {e}", file=sys.stderr)
        return 1

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
    except json.JSONDecodeError:
        print(f"Error: {config_path} is not a valid JSON file", file=sys.stderr)
        return 1

    # Update the chat_template
    config["chat_template"] = template

    try:
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        print(f"Template injected into {config_path}")
        return 0
    except Exception as e:
        print(f"Error writing to config file: {e}", file=sys.stderr)
        return 1


def main():
    parser = argparse.ArgumentParser(
        description="Extract or inject chat templates from/to tokenizer_config.json"
    )
    subparsers = parser.add_subparsers(
        dest="command", help="Command to execute", required=True
    )

    # Extract command
    extract_parser = subparsers.add_parser(
        "extract", help="Extract chat template from tokenizer_config.json"
    )
    extract_parser.add_argument("config_path", help="Path to tokenizer_config.json")
    extract_parser.add_argument(
        "--output",
        "-o",
        dest="output_path",
        help="Output file path (default: ./chat_template.jinja)",
    )

    # Inject command
    inject_parser = subparsers.add_parser(
        "inject", help="Inject chat template into tokenizer_config.json"
    )
    inject_parser.add_argument("template_path", help="Path to template file")
    inject_parser.add_argument("config_path", help="Path to tokenizer_config.json")

    args = parser.parse_args()

    if args.command == "extract":
        return extract_template(args.config_path, args.output_path)
    elif args.command == "inject":
        return inject_template(args.template_path, args.config_path)


if __name__ == "__main__":
    sys.exit(main())
