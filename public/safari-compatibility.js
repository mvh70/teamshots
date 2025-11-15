// Safari compatibility check
if (typeof window !== 'undefined') {
  // Check for required features
  if (!window.Promise) {
    console.error('Promise not supported - Safari version too old');
  }
}

