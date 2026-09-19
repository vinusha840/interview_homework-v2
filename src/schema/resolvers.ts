import { getAddress, createAddress } from "./address/address";
import { Address, Args, CreateAddressArgs } from "./address/types";


export const resolvers = {
  Query: {
    address: async (parent: any, args: Args, context: any, _info: any): Promise<Address> => {
      return await getAddress(parent, args, context);
    },
  },
  Mutation: {
    createAddress: async (parent: any, args: CreateAddressArgs, context: any, _info: any): Promise<Address> => {
      return await createAddress(parent, args, context);
    },
  },
};
