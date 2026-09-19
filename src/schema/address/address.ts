import fs from 'fs';
import path from 'path';
import { Addresses, Address, Args, CreateAddressArgs } from './types';
import { GraphQLError } from 'graphql';

const filePath = path.join(__dirname, '../../../data/addresses.json');

const readAddresses = async (): Promise<Addresses> => {
  const raw = await fs.promises.readFile(filePath, 'utf-8');
  return JSON.parse(raw) as Addresses;
};

const writeAddresses = async (addresses: Addresses): Promise<void> => {
  await fs.promises.writeFile(
    filePath,
    JSON.stringify(addresses, null, 2),
    'utf-8',
  );
};

export const getAddress = async (_: any, args: Args, context: any): Promise<Address> => {
  context.logger.info('getAddress', { message: 'Enter resolver' });
  const addresses = await readAddresses();
  const address = addresses[args.username];
  if (address) {
    context.logger.info('getAddress', { message: 'Returning address' });
    return address;
  }
  context.logger.error('getAddress', { message: 'No address found' });
  throw new GraphQLError('No address found in getAddress resolver');
};

export const createAddress = async (_: any, args: CreateAddressArgs, context: any): Promise<Address> => {
  context.logger.info('createAddress', { message: 'Enter resolver' });
  const addresses = await readAddresses();
  if (addresses[args.username]) {
    context.logger.error('createAddress', { message: 'Address already exists' });
    throw new GraphQLError('Address already exists for this username');
  }
  addresses[args.username] = args.address;
  await writeAddresses(addresses);
  context.logger.info('createAddress', { message: 'Address created' });
  return args.address;
};
