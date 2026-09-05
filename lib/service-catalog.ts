export type ServiceTemplate = {
  name: string;
  description: string;
  durationMinutes: number;
  priceHint?: string;
};

export const SERVICE_CATALOG: Record<string, ServiceTemplate[]> = {
  "fitness-personal-training": [
    { name: "1-on-1 Personal Training", description: "Private coaching tailored to your goals, fitness level and pace.", durationMinutes: 60 },
    { name: "Hotel & Villa Personal Training", description: "A private training session delivered at your hotel, villa or residence.", durationMinutes: 60 },
    { name: "Strength & Conditioning", description: "Structured strength, mobility and conditioning session with a qualified trainer.", durationMinutes: 60 },
    { name: "HIIT & Functional Training", description: "High-energy functional workout designed around your fitness level.", durationMinutes: 45 },
    { name: "Running Coaching", description: "Personal running assessment, technique and training guidance.", durationMinutes: 60 },
    { name: "Couples Personal Training", description: "Private workout for two with one dedicated trainer.", durationMinutes: 60 },
  ],
  fitness: [
    { name: "Personal Training Session", description: "Private fitness coaching with a local trainer.", durationMinutes: 60 },
    { name: "Group Fitness Class", description: "Instructor-led fitness session for a small group.", durationMinutes: 60 },
    { name: "HIIT Workout", description: "Efficient high-intensity interval training session.", durationMinutes: 45 },
  ],
  "yoga-pilates-mindfulness": [
    { name: "Private Yoga Session", description: "Personalized yoga practice with an experienced instructor.", durationMinutes: 60 },
    { name: "Sunrise Beach Yoga", description: "Guided morning yoga session in a peaceful outdoor setting.", durationMinutes: 60 },
    { name: "Private Pilates Session", description: "Personalized Pilates session focused on strength, posture and control.", durationMinutes: 60 },
    { name: "Meditation & Breathwork", description: "Guided breathing and mindfulness session for relaxation and reset.", durationMinutes: 45 },
    { name: "Sound Bath", description: "Guided sound meditation designed for deep relaxation.", durationMinutes: 60 },
  ],
  "boxing-martial-arts": [
    { name: "Private Boxing Training", description: "One-on-one boxing coaching covering technique, conditioning and pad work.", durationMinutes: 60 },
    { name: "Boxing Fitness", description: "Non-contact boxing workout combining technique and cardio.", durationMinutes: 60 },
    { name: "Kickboxing Training", description: "Private kickboxing technique and conditioning session.", durationMinutes: 60 },
    { name: "Self-Defense Session", description: "Practical personal safety and self-defense coaching.", durationMinutes: 60 },
  ],
  "running-cycling": [
    { name: "Running Coach Session", description: "Technique, pacing and personalized running guidance.", durationMinutes: 60 },
    { name: "Guided City Run", description: "Run a local route with an experienced guide.", durationMinutes: 60 },
    { name: "Trail Running Session", description: "Guided trail run adapted to your experience and pace.", durationMinutes: 90 },
    { name: "Cycling Coaching", description: "Technique and training session with a local cycling coach.", durationMinutes: 60 },
    { name: "Guided Cycling Tour", description: "Explore the area by bicycle with a local guide.", durationMinutes: 120 },
  ],
  "sports-recovery": [
    { name: "Sports Massage", description: "Targeted massage for active travelers and athletes.", durationMinutes: 60 },
    { name: "Assisted Stretching", description: "Guided assisted stretching for mobility and recovery.", durationMinutes: 45 },
    { name: "Mobility & Recovery Session", description: "Movement-focused recovery session for stiffness and range of motion.", durationMinutes: 60 },
    { name: "Recovery Session", description: "Personalized post-training recovery session.", durationMinutes: 60 },
  ],
  "private-chefs-cooking": [
    { name: "Private Chef Experience", description: "A private chef prepares a personalized meal in your villa, home or venue.", durationMinutes: 180 },
    { name: "Swahili Cooking Class", description: "Learn to prepare classic Swahili dishes with a local cook.", durationMinutes: 150 },
    { name: "Kenyan Cooking Class", description: "Hands-on introduction to Kenyan home cooking and local flavors.", durationMinutes: 150 },
    { name: "Market & Cooking Experience", description: "Explore local ingredients and turn them into a shared meal.", durationMinutes: 180 },
  ],
  "photography-content": [
    { name: "Vacation Photoshoot", description: "Professional lifestyle photography during your trip.", durationMinutes: 60 },
    { name: "Beach Sunset Photoshoot", description: "Golden-hour portrait session at a beautiful coastal location.", durationMinutes: 60 },
    { name: "Couples Photoshoot", description: "Relaxed professional photography for couples and honeymoons.", durationMinutes: 60 },
    { name: "Family Photoshoot", description: "Natural family portraits during your stay.", durationMinutes: 60 },
    { name: "Social Media Content Session", description: "Create polished travel content for Instagram, TikTok or other channels.", durationMinutes: 90 },
  ],
  "arts-crafts": [
    { name: "Beadwork Workshop", description: "Hands-on local beadwork session with a craft maker.", durationMinutes: 90 },
    { name: "Pottery Workshop", description: "Create your own piece in a guided pottery session.", durationMinutes: 120 },
    { name: "Batik & Textile Workshop", description: "Learn traditional textile techniques in a practical workshop.", durationMinutes: 120 },
    { name: "Painting Workshop", description: "Relaxed guided painting session inspired by local surroundings.", durationMinutes: 120 },
    { name: "Wood Carving Workshop", description: "Learn traditional carving techniques with a local artisan.", durationMinutes: 120 },
  ],
  "dance-music": [
    { name: "Afro Dance Lesson", description: "Private or small-group African dance lesson with a local instructor.", durationMinutes: 60 },
    { name: "Salsa & Bachata Lesson", description: "Beginner-friendly private dance lesson.", durationMinutes: 60 },
    { name: "African Drumming Lesson", description: "Hands-on rhythm and drumming session with a local musician.", durationMinutes: 60 },
    { name: "Guitar Lesson", description: "Private guitar lesson adapted to your level.", durationMinutes: 60 },
  ],
  "horse-riding-equestrian": [
    { name: "Beach Horse Ride", description: "Guided horseback ride along a scenic coastal route.", durationMinutes: 60 },
    { name: "Sunset Horse Ride", description: "Evening horseback experience timed for sunset.", durationMinutes: 90 },
    { name: "Horse Riding Lesson", description: "Private riding lesson with an experienced instructor.", durationMinutes: 60 },
  ],
  "adventure-outdoor-skills": [
    { name: "Guided Hike", description: "Private guided hike adapted to your pace and experience.", durationMinutes: 180 },
    { name: "Outdoor Skills Session", description: "Learn practical navigation, camping and outdoor skills.", durationMinutes: 120 },
    { name: "Rock Climbing Session", description: "Guided climbing session with appropriate local equipment and instruction.", durationMinutes: 120 },
    { name: "Abseiling & Rappelling", description: "Guided rappelling experience with qualified instructors.", durationMinutes: 120 },
  ],
  "water-sports-kite": [
    { name: "Kitesurfing Beginner Lesson", description: "Instructor-led introduction to kite control and safe water skills.", durationMinutes: 90 },
    { name: "Kitesurfing Intermediate Lesson", description: "Technique coaching for riders building confidence and skills.", durationMinutes: 90 },
    { name: "Windsurfing Lesson", description: "Learn the fundamentals of windsurfing with an instructor.", durationMinutes: 90 },
    { name: "Wakeboarding Session", description: "Instructor-led wakeboarding session for beginners or improving riders.", durationMinutes: 60 },
  ],
  "surfing-board-sports": [
    { name: "Private Surf Lesson", description: "One-on-one surf coaching adapted to your level.", durationMinutes: 90 },
    { name: "Group Surf Lesson", description: "Small-group beginner surf lesson.", durationMinutes: 90 },
    { name: "SUP Lesson", description: "Stand-up paddleboarding instruction and guided practice.", durationMinutes: 90 },
    { name: "SUP Guided Tour", description: "Explore calm coastal waters by stand-up paddleboard.", durationMinutes: 120 },
  ],
  "diving-marine": [
    { name: "Discover Scuba Experience", description: "Introductory scuba experience with qualified dive professionals.", durationMinutes: 180 },
    { name: "Scuba Refresher", description: "Guided refresher session for certified divers returning to the water.", durationMinutes: 120 },
    { name: "Private Snorkeling Guide", description: "Private guided snorkeling experience with local marine knowledge.", durationMinutes: 120 },
    { name: "Freediving Session", description: "Instructor-led freediving training for appropriate participants.", durationMinutes: 90 },
  ],
  "sailing-boat-trips": [
    { name: "Private Sailing Trip", description: "Private sailing experience with a local skipper.", durationMinutes: 180 },
    { name: "Sunset Dhow Cruise", description: "Relaxed traditional dhow cruise timed for sunset.", durationMinutes: 120 },
    { name: "Sailing Lesson", description: "Practical introduction to sailing with an experienced instructor.", durationMinutes: 120 },
  ],
  "fishing-ocean-charters": [
    { name: "Deep-Sea Fishing Charter", description: "Guided offshore fishing trip with local crew.", durationMinutes: 240 },
    { name: "Sport Fishing Trip", description: "Private fishing experience tailored to the local waters and season.", durationMinutes: 240 },
  ],
  "coastal-adventure": [
    { name: "Kayaking Adventure", description: "Guided kayaking experience through scenic coastal waters.", durationMinutes: 120 },
    { name: "Mangrove Kayak Tour", description: "Explore mangroves by kayak with a local guide.", durationMinutes: 150 },
    { name: "Coastal Cycling Adventure", description: "Guided bicycle exploration of the local coast and communities.", durationMinutes: 120 },
  ],
  "culture-culinary": [
    { name: "Swahili Food Experience", description: "Taste and learn about local Swahili food and traditions.", durationMinutes: 120 },
    { name: "Local Culture Workshop", description: "Hands-on introduction to local traditions, stories and everyday culture.", durationMinutes: 120 },
  ],
  "tours-local-guides": [
    { name: "Private Local Guide", description: "Private guided experience tailored to your interests.", durationMinutes: 180 },
    { name: "Heritage Walking Tour", description: "Guided exploration of local history, architecture and culture.", durationMinutes: 120 },
    { name: "Nature & Wildlife Guide", description: "Guided nature experience with local knowledge.", durationMinutes: 180 },
  ],
  "marine-conservation": [
    { name: "Marine Conservation Experience", description: "Learn about and participate in local marine conservation work.", durationMinutes: 120 },
    { name: "Turtle Conservation Visit", description: "Educational conservation experience focused on sea turtles.", durationMinutes: 120 },
    { name: "Reef Conservation Experience", description: "Learn about local reefs and responsible marine stewardship.", durationMinutes: 120 },
  ],
  "hair-beauty": [
    { name: "Hair Styling", description: "Professional hair styling appointment.", durationMinutes: 60 },
    { name: "Braiding", description: "Professional braiding service.", durationMinutes: 120 },
    { name: "Mobile Hair Styling", description: "Hair styling delivered at your hotel or villa.", durationMinutes: 90 },
    { name: "Makeup Application", description: "Professional makeup application for events, photos or evenings out.", durationMinutes: 60 },
  ],
  barbers: [
    { name: "Classic Haircut", description: "Professional haircut tailored to your style.", durationMinutes: 45 },
    { name: "Haircut & Beard", description: "Haircut with beard shaping and finishing.", durationMinutes: 60 },
    { name: "Mobile Barber", description: "Barber service delivered at your hotel or villa.", durationMinutes: 60 },
  ],
  nails: [
    { name: "Manicure", description: "Professional manicure appointment.", durationMinutes: 45 },
    { name: "Pedicure", description: "Professional pedicure appointment.", durationMinutes: 60 },
    { name: "Gel Manicure", description: "Gel manicure with professional finish.", durationMinutes: 75 },
  ],
  "lashes-brows": [
    { name: "Brow Shaping", description: "Professional brow shaping and finishing.", durationMinutes: 30 },
    { name: "Lash Extensions", description: "Professional lash extension appointment.", durationMinutes: 120 },
    { name: "Lash Lift", description: "Lash lift and finishing service.", durationMinutes: 60 },
  ],
  "spas-massage": [
    { name: "Relaxation Massage", description: "Calming massage designed to help you unwind.", durationMinutes: 60 },
    { name: "Deep Tissue Massage", description: "Focused massage for deeper muscular tension.", durationMinutes: 60 },
    { name: "Couples Massage", description: "Relaxing massage experience for two.", durationMinutes: 60 },
    { name: "Mobile Hotel Massage", description: "Massage delivered privately at your hotel or villa.", durationMinutes: 60 },
  ],
  wellness: [
    { name: "Wellness Consultation", description: "Personalized wellness session focused on your goals.", durationMinutes: 60 },
    { name: "Guided Relaxation", description: "Private guided relaxation and reset session.", durationMinutes: 45 },
  ],
  automotive: [
    { name: "Mobile Car Wash & Detail", description: "Vehicle cleaning and detailing delivered where you are.", durationMinutes: 120 },
    { name: "Vehicle Inspection", description: "Basic vehicle inspection by a qualified service provider.", durationMinutes: 60 },
  ],
  "home-services": [
    { name: "Villa Cleaning", description: "Professional cleaning service for homes, villas and holiday rentals.", durationMinutes: 120 },
    { name: "Laundry Service", description: "Convenient laundry collection and service.", durationMinutes: 60 },
    { name: "Handyman Visit", description: "General household repair and maintenance visit.", durationMinutes: 60 },
  ],
  "pet-care": [
    { name: "Pet Grooming", description: "Professional grooming appointment for your pet.", durationMinutes: 90 },
    { name: "Pet Sitting", description: "Scheduled in-home pet care while you are away.", durationMinutes: 60 },
    { name: "Dog Walking", description: "Local dog walking service.", durationMinutes: 45 },
  ],
  photography: [
    { name: "Portrait Photography", description: "Professional portrait photography session.", durationMinutes: 60 },
    { name: "Event Photography", description: "Professional coverage for a private event or celebration.", durationMinutes: 120 },
  ],
  "sports-skills-training": [
    { name: "Swimming Lesson", description: "Private swimming instruction adapted to your level.", durationMinutes: 60 },
    { name: "Sports Coaching", description: "Private coaching session for your chosen sport.", durationMinutes: 60 },
    { name: "Athletic Conditioning", description: "Performance-focused conditioning session.", durationMinutes: 60 },
  ],
};

export function getServiceTemplates(slug?: string | null) {
  return slug ? SERVICE_CATALOG[slug] ?? [] : [];
}
