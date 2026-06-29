import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { LoanApplication } from './loan-application.entity';

describe('LoanApplication entity', () => {
  it('stores conditions as JSON so punctuation is preserved', () => {
    const conditionsColumn = getMetadataArgsStorage().columns.find(
      (column) =>
        column.target === LoanApplication &&
        column.propertyName === 'conditions',
    );

    expect(conditionsColumn?.options.type).toBe('simple-json');
  });
});
