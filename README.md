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

Then load up your browser to the URL that flask run outputs.

## Features

- Renders jinja templates with a variety of test cases.
- Re-renders templates when either the template files or the test data is edited.

## TODO

- Better test cases
- Perhaps a way to manage test cases
