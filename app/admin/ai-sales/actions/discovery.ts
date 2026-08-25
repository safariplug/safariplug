export type DiscoveryResult = {
  business_name: string;
  category: string;
  city: string;
  website?: string;
  instagram?: string;
  description: string;
};



const discoveryDatabase: Record<
  string,
  Record<string, DiscoveryResult[]>
> = {

  Nairobi: {

    Hotels: [
      {
        business_name:
          "Sarova Stanley",

        category:
          "Hotels",

        city:
          "Nairobi",

        website:
          "https://www.sarovahotels.com",

        instagram:
          "@sarovahotels",

        description:
          "Historic luxury hotel with strong tourism and business traveler appeal."
      },

      {
        business_name:
          "Hemingways Nairobi",

        category:
          "Hotels",

        city:
          "Nairobi",

        website:
          "https://www.hemingwayscollection.com",

        instagram:
          "@hemingwayscollection",

        description:
          "Premium boutique hotel attracting luxury travelers and safari guests."
      },

      {
        business_name:
          "Villa Rosa Kempinski Nairobi",

        category:
          "Hotels",

        city:
          "Nairobi",

        website:
          "https://www.kempinski.com",

        instagram:
          "@kempinskinairobi",

        description:
          "Luxury hospitality brand suitable for premium SafariPlug partnerships."
      }
    ],


    Restaurants: [
      {
        business_name:
          "Carnivore Restaurant Nairobi",

        category:
          "Restaurants",

        city:
          "Nairobi",

        website:
          "https://tamarind.co.ke",

        instagram:
          "@tamarindrestaurants",

        description:
          "Iconic dining experience popular with tourists visiting Nairobi."
      }
    ],

  },


  Mombasa: {

    "Beach Clubs": [
      {
        business_name:
          "Mombasa Beach Club Experience",

        category:
          "Beach Clubs",

        city:
          "Mombasa",

        instagram:
          "@mombasabeach",

        description:
          "Coastal leisure experience with strong traveler discovery potential."
      }
    ]

  },


  Zanzibar: {

    "Beach Clubs": [
      {
        business_name:
          "Zanzibar Beach Experience",

        category:
          "Beach Clubs",

        city:
          "Zanzibar",

        instagram:
          "@zanzibarbeachlife",

        description:
          "Island experience partner opportunity targeting international visitors."
      }
    ]

  },


  Diani: {

    Experiences: [
      {
        business_name:
          "Diani Adventure Experiences",

        category:
          "Experiences",

        city:
          "Diani",

        instagram:
          "@dianiexperiences",

        description:
          "Beach and adventure activities suitable for SafariPlug travelers."
      }
    ]

  }

};



export function discoverBusinesses(
  city: string,
  category: string
): DiscoveryResult[] {


  const results =
    discoveryDatabase[city]?.[category];


  if (results) {

    return results;

  }



  return [

    {
      business_name:
        `${city} ${category} Partner Opportunity`,

      category,

      city,

      website:
        "Not discovered",

      instagram:
        "Not discovered",

      description:
        `Potential ${category.toLowerCase()} partner opportunity discovered for SafariPlug in ${city}.`

    }

  ];

}