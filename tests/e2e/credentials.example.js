// Copy to credentials.js. That local file is ignored by Git and CI artifacts.
// Only dedicated test accounts. Leave blank for the disposable local suite.
export default {
  baseURL: '',
  users: {
    host: { email: '', password: '' },
    player2: { email: '', password: '' },
    player3: { email: '', password: '' },
    outsider: { email: '', password: '' },
  },
};
