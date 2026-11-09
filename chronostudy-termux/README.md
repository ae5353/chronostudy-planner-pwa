# ChronoStudy Termux CLI

A terminal-first study planner and tracker optimized for Termux on Android, with local storage and zero dependencies.

## Features
- **Fast CLI**: Log sessions, check study streaks, and manage tasks from the command line (`cs log`, `cs status`, `cs task`).
- **Zero dependencies**: Pure Node.js CLI using standard libraries.
- **Local Storage**: JSON-based persistent storage on your Android device.

## Usage
```bash
node bin/cs.js status
node bin/cs.js log "Algorithms" 45m "Graph theory review"
node bin/cs.js task add "Finish thesis chapter" --priority high
```

## Running Tests
```bash
node --test test/
```
