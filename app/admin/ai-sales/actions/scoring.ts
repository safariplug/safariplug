export type ScoringInput = {
  business_name: string;
  category: string;
  city: string;
};


export type ScoringResult = {
  score: number;
  priority: "High" | "Medium" | "Low";
  reason: string;
};



export function scoreProspect(
  prospect: ScoringInput
): ScoringResult {


  let score = 50;

  const reasons: string[] = [];



  // Category scoring

  if (
    prospect.category === "Hotels"
  ) {

    score += 25;

    reasons.push(
      "Strong tourism partnership category"
    );

  }



  if (
    prospect.category === "Experiences"
  ) {

    score += 20;

    reasons.push(
      "Direct traveler engagement opportunity"
    );

  }



  if (
    prospect.category === "Beach Clubs"
  ) {

    score += 18;

    reasons.push(
      "High leisure discovery potential"
    );

  }



  if (
    prospect.category === "Restaurants"
  ) {

    score += 12;

    reasons.push(
      "Local discovery value"
    );

  }



  if (
    prospect.category === "Nightlife"
  ) {

    score += 15;

    reasons.push(
      "Entertainment discovery opportunity"
    );

  }



  // City scoring

  const tourismCities = [
    "Nairobi",
    "Mombasa",
    "Diani",
    "Kilifi",
    "Zanzibar",
    "Malindi",
    "Watamu"
  ];



  if (
    tourismCities.includes(
      prospect.city
    )
  ) {

    score += 10;

    reasons.push(
      "Priority SafariPlug destination"
    );

  }



  // Cap score

  if (score > 100) {
    score = 100;
  }



  let priority:
    "High" | "Medium" | "Low";

  if (score >= 85) {

    priority = "High";

  } else if (score >= 70) {

    priority = "Medium";

  } else {

    priority = "Low";

  }



  return {

    score,

    priority,

    reason:
      reasons.join(
        ". "
      ),

  };

}