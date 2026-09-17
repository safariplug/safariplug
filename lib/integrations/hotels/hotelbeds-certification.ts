export type HotelbedsRateType = "BOOKABLE" | "RECHECK" | string;

export type HotelbedsCertificationRate = {
  rateKey: string;
  rateType?: HotelbedsRateType | null;
  rateClass?: string | null;
  boardCode?: string | null;
  boardName?: string | null;
  rateComments?: string[] | null;
  promotions?: Array<{ code?: string; name?: string }> | null;
};

export type HotelbedsVoucherInput = {
  bookingReference: string;
  agencyReference?: string | null;
  hotelName: string;
  hotelAddress: string;
  hotelCategory?: string | null;
  hotelDestination?: string | null;
  hotelPhone?: string | null;
  holderName: string;
  rooms: Array<{
    roomType: string;
    boardType: string;
    passengers: Array<{ name: string; type?: "AD" | "CH"; age?: number }>;
    rateComments?: string[] | null;
  }>;
  checkIn: string;
  checkOut: string;
  supplierName?: string | null;
  supplierVat?: string | null;
};

export function hotelbedsRequiresCheckRate(rateType?: HotelbedsRateType | null) {
  return String(rateType || "").toUpperCase() === "RECHECK";
}

export function assertHotelbedsBookingRateReady(rate: HotelbedsCertificationRate, checkRateCompleted: boolean) {
  if (!rate.rateKey?.trim()) throw new Error("Hotelbeds rateKey is required before booking.");
  if (hotelbedsRequiresCheckRate(rate.rateType) && !checkRateCompleted) {
    throw new Error("Hotelbeds RECHECK rates must complete CheckRate before booking confirmation.");
  }
}

export function certificationNotices(rate: HotelbedsCertificationRate) {
  return [
    ...(rate.promotions || []).map((promotion) => promotion.name?.trim()).filter((value): value is string => Boolean(value)),
    ...(rate.rateComments || []).map((comment) => comment.trim()).filter(Boolean),
  ];
}

export function buildHotelbedsVoucher(input: HotelbedsVoucherInput) {
  if (!input.bookingReference.trim()) throw new Error("Hotelbeds booking reference is mandatory on the voucher.");
  if (!input.hotelName.trim() || !input.hotelAddress.trim()) throw new Error("Hotel name and address are mandatory on the voucher.");
  if (!input.holderName.trim()) throw new Error("Lead passenger name is mandatory on the voucher.");
  if (!input.rooms.length) throw new Error("At least one booked room is required on the voucher.");

  const rooms = input.rooms.map((room, index) => {
    if (!room.roomType.trim() || !room.boardType.trim()) throw new Error(`Room ${index + 1} must include room and board type.`);
    if (!room.passengers.length || !room.passengers.some((passenger) => passenger.name.trim())) {
      throw new Error(`Room ${index + 1} must include at least one passenger name.`);
    }
    for (const passenger of room.passengers) {
      if (passenger.type === "CH" && (!Number.isInteger(passenger.age) || Number(passenger.age) < 0)) {
        throw new Error("Child age is mandatory on the voucher when children are present.");
      }
    }
    return {
      room_type: room.roomType,
      board_type: room.boardType,
      passengers: room.passengers.map((passenger) => ({ name: passenger.name, type: passenger.type || "AD", age: passenger.age })),
      rate_comments: (room.rateComments || []).filter(Boolean),
    };
  });

  const supplierLine = input.supplierName
    ? `Payable through ${input.supplierName}, acting as agent for the service operating company${input.supplierVat ? `, VAT: ${input.supplierVat}` : ""}. Reference: ${input.bookingReference}`
    : null;

  return {
    title: "Hotel Booking Voucher",
    booking_reference: input.bookingReference,
    agency_reference: input.agencyReference || null,
    hotel: {
      name: input.hotelName,
      address: input.hotelAddress,
      category: input.hotelCategory || null,
      destination: input.hotelDestination || null,
      phone: input.hotelPhone || null,
    },
    holder_name: input.holderName,
    check_in: input.checkIn,
    check_out: input.checkOut,
    rooms,
    payment_notice: supplierLine,
  };
}
