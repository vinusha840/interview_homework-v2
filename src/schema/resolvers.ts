import { getAddress, saveAddress } from "./address/address";
import { Address, Args, SaveAddressArgs } from "./address/types";
import { getNearEarthObjects } from "./neo/nearEarthObjects";
import { NearEarthObjectFeed, NearEarthObjectsArgs } from "./neo/types";

export const resolvers = {
  Query: {
    address: (parent: any, args: Args, context: any, _info: any): Address => {
      return getAddress(parent, args, context);
    },
    nearEarthObjects: (_parent: any, args: NearEarthObjectsArgs, context: any): Promise<NearEarthObjectFeed> => {
      return getNearEarthObjects(args, context);
    },
  },
  Mutation: {
    saveAddress: (parent: any, args: SaveAddressArgs, context: any, _info: any): Address => {
      return saveAddress(parent, args, context);
    },
  },
};
