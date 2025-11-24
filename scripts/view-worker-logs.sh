#!/bin/bash
# View worker logs with various options

case "$1" in
  "tail")
    # Follow the log in real-time
    tail -f logs/worker.log
    ;;
  "dev")
    # Follow the dev log
    tail -f logs/worker-dev.log
    ;;
  "search")
    # Search for a pattern
    if [ -z "$2" ]; then
      echo "Usage: ./scripts/view-worker-logs.sh search <pattern>"
      exit 1
    fi
    grep -n "$2" logs/worker*.log
    ;;
  "last")
    # Show last N lines (default 100)
    lines=${2:-100}
    tail -n "$lines" logs/worker.log
    ;;
  "clear")
    # Clear old logs (keep last 1000 lines)
    if [ -f logs/worker.log ]; then
      tail -n 1000 logs/worker.log > logs/worker.log.tmp
      mv logs/worker.log.tmp logs/worker.log
      echo "Trimmed worker.log to last 1000 lines"
    fi
    if [ -f logs/worker-dev.log ]; then
      tail -n 1000 logs/worker-dev.log > logs/worker-dev.log.tmp
      mv logs/worker-dev.log.tmp logs/worker-dev.log
      echo "Trimmed worker-dev.log to last 1000 lines"
    fi
    ;;
  *)
    echo "Worker Log Viewer"
    echo ""
    echo "Usage:"
    echo "  ./scripts/view-worker-logs.sh tail           # Follow production log"
    echo "  ./scripts/view-worker-logs.sh dev            # Follow dev log"
    echo "  ./scripts/view-worker-logs.sh search <text>  # Search all logs"
    echo "  ./scripts/view-worker-logs.sh last [N]       # Show last N lines (default 100)"
    echo "  ./scripts/view-worker-logs.sh clear          # Trim logs to last 1000 lines"
    ;;
esac

