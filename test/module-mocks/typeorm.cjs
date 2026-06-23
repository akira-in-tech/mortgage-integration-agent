const decorator = () => () => undefined;

module.exports = {
  Column: decorator,
  CreateDateColumn: decorator,
  Entity: decorator,
  PrimaryColumn: decorator,
  Repository: class Repository {},
  UpdateDateColumn: decorator,
};
