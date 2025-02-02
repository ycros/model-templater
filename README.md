# Model Templater

A web tool to debug llm jinja prompt templates.

## Installation

I recommend using uv.

```bash
uv sync
```

## Usage

```bash
uv run flask run
```

## Features

- Renders jinja templates with a variety of test cases.
- Reloads templates on file change.

## TODO

- Better test cases
- Perhaps a way to manage test cases
- Some template formats (mistral) don't have line breaks, some sort of wrapping handling would be nice.
