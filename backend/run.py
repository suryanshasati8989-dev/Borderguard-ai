from app.main import app

if __name__ == "__main__":
    from app.config import Config

    app.run(host=Config.HOST, port=Config.PORT, debug=True, threaded=True)
