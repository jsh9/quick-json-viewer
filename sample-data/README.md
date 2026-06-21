# Sample Data

Local sample files used by the VS Code extension host launch flow are ignored
by Git.

Generate large local JSON fixtures with:

```sh
python3 sample-data/generate_large_json.py
```

The script writes `large-placeholder.json` as pretty multi-line JSON and
`large-placeholder-minified.json` with the same records on one line.

You can also create a small `sample-data/sample-data.json` manually for local
testing.
