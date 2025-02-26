import os
import tomllib

script_dir = os.path.dirname(os.path.abspath(__file__))
toml_path = os.path.join(script_dir, "test_data.toml")
TEST_DATA = {}


def load_test_data():
    global TEST_DATA

    with open(toml_path, "rb") as f:
        toml_data = tomllib.load(f)

    TEST_DATA["test_cases"] = toml_data["test_cases"]
    TEST_DATA["tokens"] = toml_data["tokens"]


# Initial load
load_test_data()
