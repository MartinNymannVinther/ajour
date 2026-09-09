# Recorded model replies

Each file is one raw reply from a real model to the chat prompt, kept as
the model wrote it: fences, wrapping, invented ids and all. The test in
`../recorded.test.ts` runs every file through the sanitizer against the
fixture project in the same folder and asserts what must come out and,
more importantly, what must not.

Add a file when a model surprises you: copy the reply verbatim into
`replies/<model>-<what>.json` with an `expect` block saying what the
sanitizer has to make of it. The point is that a surprise happens once.
