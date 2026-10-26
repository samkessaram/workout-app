import 'fake-indexeddb/auto'

// jsdom does not implement scrolling.
if (typeof Element !== 'undefined') Element.prototype.scrollIntoView ??= () => {}
