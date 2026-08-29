import subprocess
import sys


def run_script(script_path):
    """
    Run a preprocessing script using the current Python interpreter.
    """

    print()
    print("=" * 60)
    print(f"Running: {script_path}")
    print("=" * 60)
    print()

    result = subprocess.run(
        [sys.executable, script_path]
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"{script_path} failed."
        )


def main():
    """
    Run the complete preprocessing pipeline.
    """

    print("Starting preprocessing pipeline...")

    # Step 1: Combine raw datasets
    run_script(
        "preprocessing/combine_dataset.py"
    )

    # Step 2: Clean combined dataset
    run_script(
        "preprocessing/clean.py"
    )

    print()
    print("=" * 60)
    print("PREPROCESSING PIPELINE COMPLETED")
    print("=" * 60)
    print()
    print(
        "Cleaned dataset saved to:"
        " data/processed/cleaned_dataset.csv"
    )


if __name__ == "__main__":
    main()
