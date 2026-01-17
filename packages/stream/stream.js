// A generator that will yield positive integers
async function* integers() {
  let i = 1;
  while (true) {
    console.log(`yielding ${i}`);
    yield i++;

    await sleep(100);
  }
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createStream(iterator) {
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await iterator.next();

      if (done) {
        controller.close();
      } else {
        controller.enqueue(value);
      }
    },
  });
}

// // Wraps a generator into a ReadableStream
// function createStream(iterator) {
//   return new ReadableStream({
//     async start(controller) {
//       for await (const v of iterator) {
//         controller.enqueue(v);
//       }
//       controller.close();
//     },
//   });
// }

// // Collect data from stream
// async function run() {
//   // Set up a stream of integers
//   const stream = createStream(integers());

//   // Read values from our stream
//   const reader = stream.getReader();
//   for (let i = 0; i < 10_000; i++) {
//     // we know our stream is infinite, so there's no need to check `done`.
//     const { value } = await reader.read();
//     console.log(`read ${value}`);

//     await sleep(1_000);
//   }
// }

// Collect data from stream
async function run() {
  // Set up a stream that of integers
  const stream = createStream(integers());

  // Read values from our stream
  const reader = stream.getReader();
  // We're only reading 3 items this time:
  for (let i = 0; i < 3; i++) {
    // we know our stream is infinite, so there's no need to check `done`.
    const { value } = await reader.read();
    console.log(`read ${value}`);

    await sleep(1000);
  }
}
run();
