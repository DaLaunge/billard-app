// Ersatz fuer window.confirm() (Nutzer-Feedback: "alle Hinweise innerhalb
// der App als App-Popup", nicht als Browser-Dialog) - ein Singleton-Service
// statt Prop-Drilling einer Modal-Funktion durch jede Komponente. ConfirmHost
// (siehe ConfirmHost.jsx, einmal in App.jsx gemountet) meldet sich hier per
// registerConfirmListener() an; appConfirm() gibt wie window.confirm() ein
// Promise<boolean> zurueck, damit bestehende "if (!(await appConfirm(...)))
// return;"-Aufrufe strukturell genauso funktionieren wie vorher.
let listener = null;

export function registerConfirmListener(fn) {
  listener = fn;
}

export function appConfirm(message) {
  return new Promise((resolve) => {
    if (!listener) { resolve(window.confirm(message)); return; }
    listener({ message, resolve });
  });
}
