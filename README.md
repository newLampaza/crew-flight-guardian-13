
# FatigueGuard - Pilot Fatigue Monitoring System

## Project Overview

FatigueGuard is an advanced system for monitoring and analyzing pilot fatigue, leveraging machine learning and real-time video analysis.

## Prerequisites

- Python 3.9+
- Node.js 18+
- npm (Node Package Manager)
- Git

## Project Setup

### Backend Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd crew-flight
```

2. Create and activate a virtual environment:
```bash
# On Windows
python -m venv .venv
.venv\Scripts\activate

# On macOS/Linux
python3 -m venv .venv
source .venv/bin/activate
```

3. Install Python dependencies:
```bash
pip install -r requirements.txt
```

4. Set up environment variables:
```bash
# Create .env file in the root directory
cp .env.example .env
# Edit .env with your configuration
```

### Frontend Setup

1. Install Node.js dependencies:
```bash
pip install "protobuf>=3.20,<4"
npm install date-fns@^3.0.0
npm install --legacy-peer-deps
npm install --force
npm install react-day-picker@latest
npm outdated
npm install
```

### Running the Application

#### Development Mode

1. Ensure you're in the project root directory
2. Run the application:
```bash
python run.py
```

This will start both the backend (Flask) and frontend (Vite React) servers.

#### Alternative Run Methods

- Start backend separately:
```bash
python routes.py
```

- Start frontend separately:
```bash
npm run dev
```

## Environment Variables

Create a `.env` file in the root directory with the following variables:
- `SECRET_KEY`: Flask secret key
- `DATABASE_URL`: SQLite database path
- `JWT_SECRET_KEY`: JWT authentication secret
- `DEBUG`: Set to True/False

## Project Structure

- `backend/`: Flask backend code
- `src/`: React frontend code
- `neural_network/`: Machine learning models
- `database/`: Database initialization scripts

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

Distributed under the MIT License.

## Contact

Project Link: [Your Project URL]
