jest.mock('./src/vrchat/client', () => ({
  fetchWorldData: jest.fn(),
  isCurrentUser: jest.fn(),
  vrchat: {
    client: {}
  }
}));
