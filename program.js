// Coach-designed program: V-Taper Recomp 5 (8-week Cut & Build phase)
const PROGRAM = {
  name: "V-Taper Recomp 5",
  phase: { name: "Cut & Build", weeks: 8, deloadWeek: 5 },
  // index 0 = Monday ... 6 = Sunday
  split: [
    { day: "Mon", name: "Push", sub: "Shoulder Width", type: "train", cardio: { type: "Incline walk", min: 20 },
      exercises: [
        { id: "barbell-bench-press", name: "Barbell Bench Press", sets: 4, reps: "5-7", rest: 150, cue: "Shoulder blades pinned, bar to lower chest", tag: "compound", muscle: "chest" },
        { id: "seated-db-shoulder-press", name: "Seated DB Shoulder Press", sets: 3, reps: "8-10", rest: 120, cue: "Elbows slightly forward, stop short of lockout", tag: "compound", muscle: "shoulders" },
        { id: "incline-db-press", name: "Incline DB Press 30°", sets: 3, reps: "8-12", rest: 90, cue: "Deep stretch, wrists stacked", tag: "compound", muscle: "chest" },
        { id: "cable-lateral-raise", name: "Cable Lateral Raise", sets: 4, reps: "12-15", rest: 60, cue: "Lead with elbows, out not up", tag: "isolation", muscle: "shoulders" },
        { id: "overhead-cable-triceps-ext", name: "Overhead Cable Triceps Ext", sets: 3, reps: "10-12", rest: 60, cue: "Elbows fixed, full stretch", tag: "isolation", muscle: "arms" }
      ] },
    { day: "Tue", name: "Pull", sub: "Lat Width", type: "train", cardio: { type: "Incline walk", min: 20 },
      exercises: [
        { id: "weighted-pull-up", name: "Pull-Up", sets: 4, reps: "5-8", rest: 150, cue: "Chest to bar, elbows to back pockets", tag: "compound", muscle: "back" },
        { id: "chest-supported-row", name: "Chest-Supported DB Row", sets: 3, reps: "8-10", rest: 120, cue: "Pause 1s, squeeze blades", tag: "compound", muscle: "back" },
        { id: "neutral-lat-pulldown", name: "Neutral-Grip Lat Pulldown", sets: 3, reps: "10-12", rest: 90, cue: "Full stretch top, pull to upper chest", tag: "compound", muscle: "back" },
        { id: "reverse-pec-deck", name: "Reverse Pec Deck", sets: 3, reps: "15-20", rest: 60, cue: "Arms long, sweep wide, no shrug", tag: "isolation", muscle: "shoulders" },
        { id: "incline-db-curl", name: "Incline DB Curl", sets: 3, reps: "10-12", rest: 60, cue: "Elbows behind torso, 3s lower", tag: "isolation", muscle: "arms" }
      ] },
    { day: "Wed", name: "Legs A", sub: "Squat Strength", type: "train", cardio: { type: "Easy bike", min: 10 },
      exercises: [
        { id: "back-squat", name: "Back Squat", sets: 4, reps: "5-7", rest: 180, cue: "Brace hard, knees over toes", tag: "compound", muscle: "legs" },
        { id: "romanian-deadlift", name: "Romanian Deadlift", sets: 3, reps: "6-8", rest: 150, cue: "Hips back, bar on legs", tag: "compound", muscle: "legs" },
        { id: "walking-lunge", name: "DB Walking Lunge", sets: 3, reps: "10/leg", rest: 90, cue: "Long stride, torso tall", tag: "compound", muscle: "legs" },
        { id: "lying-leg-curl", name: "Lying Leg Curl", sets: 3, reps: "10-12", rest: 60, cue: "Hips down, slow lower", tag: "isolation", muscle: "legs" },
        { id: "standing-calf-raise", name: "Standing Calf Raise", sets: 3, reps: "10-15", rest: 60, cue: "2s pause in the stretch", tag: "isolation", muscle: "legs" },
        { id: "pallof-press", name: "Pallof Press", sets: 3, reps: "10/side", rest: 45, cue: "Resist rotation, ribs down", tag: "core", muscle: "core" }
      ] },
    { day: "Thu", name: "Recovery", sub: "Walk + Mobility", type: "rest", cardio: { type: "Brisk walk + mobility", min: 45 }, exercises: [] },
    { day: "Fri", name: "Upper", sub: "V-Taper Builder", type: "train", cardio: { type: "HIIT bike 8×20s", min: 12 },
      exercises: [
        { id: "standing-ohp", name: "Standing Overhead Press", sets: 4, reps: "5-7", rest: 150, cue: "Glutes tight, head through", tag: "compound", muscle: "shoulders" },
        { id: "barbell-row", name: "Barbell Row", sets: 4, reps: "6-8", rest: 120, cue: "Hinge 45°, bar to navel", tag: "compound", muscle: "back" },
        { id: "weighted-dip", name: "Dip", sets: 3, reps: "8-10", rest: 120, cue: "Slight lean, elbows 45°", tag: "compound", muscle: "chest" },
        { id: "straight-arm-pulldown", name: "Straight-Arm Pulldown", sets: 3, reps: "12-15", rest: 60, cue: "Soft elbows, sweep to thighs", tag: "isolation", muscle: "back" },
        { id: "db-lateral-raise", name: "DB Lateral Raise", sets: 4, reps: "15-20", rest: 45, cue: "Lean forward, pinkies level", tag: "isolation", muscle: "shoulders" },
        { id: "face-pull", name: "Face Pull", sets: 3, reps: "15", rest: 45, cue: "Pull to eyes, thumbs back", tag: "isolation", muscle: "shoulders" }
      ] },
    { day: "Sat", name: "Legs B", sub: "+ Arms", type: "train", cardio: { type: "Incline walk", min: 20 },
      exercises: [
        { id: "trap-bar-deadlift", name: "Trap Bar Deadlift", sets: 3, reps: "4-6", rest: 180, cue: "Push the floor away", tag: "compound", muscle: "legs" },
        { id: "bulgarian-split-squat", name: "Bulgarian Split Squat", sets: 3, reps: "8-10/leg", rest: 90, cue: "Front shin vertical", tag: "compound", muscle: "legs" },
        { id: "leg-press", name: "Leg Press", sets: 3, reps: "10-12", rest: 90, cue: "Deep, no low-back rounding", tag: "compound", muscle: "legs" },
        { id: "cable-lateral-raise", name: "Cable Lateral Raise", sets: 3, reps: "15-20", rest: 45, cue: "Constant tension, no swing", tag: "isolation", muscle: "shoulders" },
        { id: "ez-curl-pushdown-superset", name: "EZ Curl + Rope Pushdown", sets: 3, reps: "10-12", rest: 60, cue: "Strict, squeeze each end", tag: "isolation", muscle: "arms" },
        { id: "ab-wheel-rollout", name: "Ab Wheel Rollout", sets: 3, reps: "8-12", rest: 60, cue: "Tuck pelvis, no sag", tag: "core", muscle: "core" }
      ] },
    { day: "Sun", name: "Rest", sub: "Reset + Meal Prep", type: "rest", cardio: { type: "Leisure walk", min: 45 }, exercises: [] }
  ],
  progression: "Hit the top of the rep range on every set → add 5 lb (upper), 10 lb (lower) or the smallest step (isolation). Holding strength on a cut is a win.",
  deload: "Deload week: fewer sets, same weights, finish at RPE 6-7.",
  nutrition: {
    multipliers: { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725 },
    deficit: 0.20, proteinPerLb: 1.0, fatPerLb: 0.35, fiber: 30
  },
  proteinIdeas: [
    ["Whey scoop", 25], ["Greek yogurt cup", 23], ["Soya chunks 50g", 26], ["Tofu 200g", 34],
    ["Dal 1 cup", 18], ["Paneer 100g", 20], ["Tempeh 100g", 20], ["Chickpeas 1 cup", 15]
  ],
  tips: [
    "Weigh daily, judge weekly. Only the 7-day average matters.",
    "Leave 1-2 reps in reserve on compounds. Push isolations close to failure.",
    "Side delts grow fastest with frequent, high-rep, strict sets.",
    "Pull with your elbows, not your hands, to feel your lats.",
    "Hold your strength on a cut and you keep the muscle.",
    "Build every meal around protein: dairy, soya, tofu or dal. Then veg, then carbs.",
    "Ab wheel and hanging leg raises progress better than crunches.",
    "Abs show from low body fat, not extra ab reps.",
    "Hungry? Drink water, eat high-volume veg, wait 15 minutes.",
    "Put your carbs around training for better sessions.",
    "Steps drive most fat loss. Walk after meals.",
    "Same weight for more reps is still progress. Log every set.",
    "Take B12, vitamin D and 5 g creatine daily. Vegetarians benefit most.",
    "One off-plan meal is a blip. Get straight back on plan."
  ]
};
