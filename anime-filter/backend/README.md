# AnimePick Python Backend

## Development Setup

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run in development mode
python main.py --dev
```

## Production Build (PyInstaller)

```bash
# Install PyInstaller
pip install pyinstaller

# Build standalone executable
pyinstaller --onefile --name animepick-backend main.py

# Output will be in dist/animepick-backend
```

## API Endpoints

- `GET /health` - Health check
- `GET /api/anime/list` - Get anime list
- `POST /api/anime/mark` - Mark anime status
- `POST /api/ai/recommend` - Get AI recommendations
