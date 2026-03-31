import os
import sys


def main() -> int:
    if len(sys.argv) < 2:
        print("Uso:")
        print("python main.py camera")
        print("python main.py image <caminho_da_imagem>")
        print("python main.py train")
        return 1

    command = sys.argv[1].lower()

    if command == "camera":
        from inference.detect_camera import run_camera_detection
        run_camera_detection()
        return 0

    if command == "image":
        if len(sys.argv) < 3:
            print("Informe o caminho da imagem.")
            return 1

        image_path = sys.argv[2]
        if not os.path.exists(image_path):
            print(f"Imagem não encontrada: {image_path}")
            return 1

        from inference.detect_image import run_image_detection
        run_image_detection(image_path)
        return 0

    if command == "train":
        from training.train import run_training
        run_training()
        return 0

    print(f"Comando inválido: {command}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main()) 