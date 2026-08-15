jest.mock('./src/vrchat/client', () => ({
  fetchWorldData: jest.fn(),
  searchWorldsByName: jest.fn(),
  isCurrentUser: jest.fn(),
  ensureAuthenticated: jest.fn(),
  vrchat: {
    client: {}
  }
}));
