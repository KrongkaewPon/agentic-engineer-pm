This folder contains start and stop scripts for Mac, Linux, and Windows.

Current scripts:
- `start-mac.sh`, `stop-mac.sh`
- `start-linux.sh`, `stop-linux.sh`
- `start-windows.bat`, `stop-windows.bat`

Guidelines:
- Scripts should run from any current directory by resolving project root first.
- Keep scripts thin wrappers around Docker Compose commands.