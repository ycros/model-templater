TEST_CASES = {
    "basic": {
        "messages": [
            {"role": "system", "content": "You are a helpful AI"},
            {"role": "user", "content": "Hello!"},
            {"role": "assistant", "content": "Hello! How can I help you today?"},
        ]
    },
    "empty": {"messages": []},
    "no sys": {
        "messages": [
            {"role": "user", "content": "Hello!"},
            {"role": "assistant", "content": "Hello! How can I help you today?"},
        ]
    },
    "user last": {
        "messages": [
            {"role": "user", "content": "Hello!"},
            {"role": "assistant", "content": "Hello! How can I help you today?"},
            {"role": "user", "content": "What is the weather in Tokyo?"},
        ]
    },
    "user last sys": {
        "messages": [
            {"role": "system", "content": "You are a helpful AI"},
            {"role": "user", "content": "Hello!"},
            {"role": "assistant", "content": "Hello! How can I help you today?"},
            {"role": "user", "content": "What is the weather in Tokyo?"},
        ]
    },
    "double user": {
        "messages": [
            {"role": "user", "content": "Hello!"},
            {"role": "assistant", "content": "Hello! How can I help you today?"},
            {"role": "user", "content": "What is the weather in Tokyo?"},
            {"role": "user", "content": "How many cats are there in the world?"},
        ]
    },
    "double user sys": {
        "messages": [
            {"role": "system", "content": "You are a helpful AI"},
            {"role": "user", "content": "Hello!"},
            {"role": "assistant", "content": "Hello! How can I help you today?"},
            {"role": "user", "content": "What is the weather in Tokyo?"},
            {"role": "user", "content": "How many cats are there in the world?"},
        ]
    },
    "invalid role": {
        "messages": [
            {"role": "invalid", "content": "Hello!"},
        ]
    },
    "tools": {
        "messages": [
            {"role": "system", "content": "You are a helpful AI"},
            {"role": "user", "content": "Hello!"},
            {
                "role": "tool",
                "content": "derp",
                "tool_calls_json": "[{'name': 'tool_name', 'arguments': 'example_arg: 1.0, another_example_arg: true', 'type': 'function'}]",
            },
            {"role": "assistant", "content": "Hello! How can I help you today?"},
        ],
        "tools_json": '[{"name": "tool_name", "arguments": "example_arg: 1.0, another_example_arg: true", "type": "function"}]',
    },
    "think basic": {
        "messages": [
            {"role": "system", "content": "You are a helpful AI"},
            {"role": "user", "content": "Hello!"},
            {
                "role": "assistant",
                "content": "<think>Hmm, let me think...</think>Hi! How can I help you today?",
            },
        ]
    },
    "think user last": {
        "messages": [
            {"role": "user", "content": "Hello!"},
            {
                "role": "assistant",
                "content": "<think>Hmm, let me think...</think>Hi! How can I help you today?",
            },
            {"role": "user", "content": "What is the weather in Tokyo?"},
        ]
    },
    "think user last sys": {
        "messages": [
            {"role": "system", "content": "You are a helpful AI"},
            {"role": "user", "content": "Hello!"},
            {
                "role": "assistant",
                "content": "<think>Hmm, let me think...</think>Hi! How can I help you today?",
            },
            {"role": "user", "content": "What is the weather in Tokyo?"},
        ]
    },
}

TOKENS = {"bos_token": "BOS_", "eos_token": "_EOS", "sep_token": "<|>"}
