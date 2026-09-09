type ScorableEvent = Record<string, unknown>;

export function calculateAIScore(event: ScorableEvent) {
  let score = 0;

  const checks = {
    source: false,
    image: false,
    city: false,
    venue: false,
    date: false,
    price: false,
    organizer: false,
  };

  if (event.source_url) {
    score += 15;
    checks.source = true;
  }

  if (event.image_url) {
    score += 15;
    checks.image = true;
  }

  if (event.city_id || event.cities) {
    score += 15;
    checks.city = true;
  }

  if (typeof event.venue_name === "string" && event.venue_name !== "To be verified") {
    score += 15;
    checks.venue = true;
  }

  if (event.start_at) {
    score += 15;
    checks.date = true;
  }

  if (event.price) {
    score += 10;
    checks.price = true;
  }

  if (event.organizer_name) {
    score += 15;
    checks.organizer = true;
  }

  return { score, checks };
}
