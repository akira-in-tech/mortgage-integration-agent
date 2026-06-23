const decorator = () => () => undefined;

module.exports = {
  Args: decorator,
  Field: decorator,
  Float: Number,
  ID: String,
  InputType: decorator,
  ObjectType: decorator,
  Query: decorator,
  Resolver: decorator,
  registerEnumType: () => undefined,
};
