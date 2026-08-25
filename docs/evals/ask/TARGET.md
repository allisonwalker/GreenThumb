# Ask eval target

**Product promise:** Ask answers one free-text question about *this* household garden from stored records (crop catalog, plantings, weather, care log, open Today tasks) so Allison or her husband can act — or correctly refuse — without generic chatbot advice.

**Unit under test:** one Ask turn: the model's `finalText` plus `toolTrace` for a single user question against a frozen in-memory garden fixture.

**Out of scope for this score:** generating the Today list, time-budget packing, crop-row draft, auth, notifications, and overall app quality. Those have other tests.

**Pass unit:** the reply is checkable against the fixture (or is a correct abstain/clarify). A fluent paragraph that could be true of some other garden is a fail.
