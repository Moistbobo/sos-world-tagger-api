jest.mock('./src/vrchat/client', () => ({
  fetchWorldData: jest.fn(),
  isCurrentUser: jest.fn(),
  ensureAuthenticated: jest.fn(),
  vrchat: {
    client: {}
  }
}));
