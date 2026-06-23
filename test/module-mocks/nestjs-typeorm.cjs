module.exports = {
  getRepositoryToken: (entity) => `${entity.name}Repository`,
  InjectRepository: () => () => undefined,
  TypeOrmModule: {
    forFeature: () => ({}),
    forRoot: () => ({}),
    forRootAsync: () => ({}),
  },
};
