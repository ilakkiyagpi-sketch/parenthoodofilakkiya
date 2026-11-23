// Age themes, first-year physical checks, the emotional-intelligence roadmap and
// India's national (government) immunisation schedule.

// ------------------------------------------------------------------ themes
// Month 0–11: a new theme every month, matching what babies typically do then.
// After the first birthday: one theme per age stage.
// accent = buttons/highlights (dark enough for white text); dark = accent in dark mode;
// hero = header gradient (light, dark); deco = decorative emojis in the header.
export const MONTH_THEMES = [
  { m: 0, name: 'Newborn Snuggles', emoji: '🍼', about: 'Feeding, sleeping and lots of cuddles. Your voice and touch are everything.', accent: '#c2410c', dark: '#fdba74', hero: ['#fff1e6', '#ffe4ec'], heroDark: ['#3a2418', '#3a1d2a'], deco: '🍼 🤍 ☁️' },
  { m: 1, name: 'First Smiles', emoji: '😊', about: 'Social smiles begin — smile and talk back to every one.', accent: '#a16207', dark: '#fde047', hero: ['#fffbe0', '#fff0d9'], heroDark: ['#3a3214', '#3a2a14'], deco: '😊 🌼 ✨' },
  { m: 2, name: 'Coos & Gazes', emoji: '🎶', about: 'Cooing, following faces and lights. Sing, chat and wait for replies.', accent: '#0f766e', dark: '#5eead4', hero: ['#e3fbf5', '#eaf4ff'], heroDark: ['#123430', '#172a3d'], deco: '🎶 🌈 🫧' },
  { m: 3, name: 'Tummy Time Champ', emoji: '🐢', about: 'Holding the head up, pushing on arms, reaching for toys.', accent: '#0e7490', dark: '#67e8f9', hero: ['#e2f7fc', '#e9fbea'], heroDark: ['#12303a', '#16331e'], deco: '🐢 🌿 🐸' },
  { m: 4, name: 'Little Roller', emoji: '🌀', about: 'Rolling over, laughing out loud, grabbing everything.', accent: '#0369a1', dark: '#7dd3fc', hero: ['#e6f2ff', '#f0ebff'], heroDark: ['#14283d', '#251f3d'], deco: '🌀 🎈 🪁' },
  { m: 5, name: 'Grab & Giggle', emoji: '🧸', about: 'Grasping, mouthing toys, giggles and blowing raspberries.', accent: '#be123c', dark: '#fda4af', hero: ['#ffe8ee', '#fff1e3'], heroDark: ['#3d1a24', '#3a2716'], deco: '🧸 🎀 💕' },
  { m: 6, name: 'First Tastes', emoji: '🥕', about: 'Starting solid foods, sitting with support, babbling.', accent: '#c2410c', dark: '#fdba74', hero: ['#fff0dc', '#eefbe6'], heroDark: ['#3a2716', '#1d331a'], deco: '🥕 🍌 🥣' },
  { m: 7, name: 'Sitting Star', emoji: '⭐', about: 'Sitting alone, passing toys hand to hand, "ba-ba" sounds.', accent: '#6d28d9', dark: '#c4b5fd', hero: ['#f0eaff', '#fff4dc'], heroDark: ['#271f45', '#3a3016'], deco: '⭐ 🌙 ✨' },
  { m: 8, name: 'Peek-a-boo Explorer', emoji: '🙈', about: 'Peek-a-boo, finding hidden toys, wary of strangers.', accent: '#be185d', dark: '#f9a8d4', hero: ['#ffe9f4', '#efeaff'], heroDark: ['#3d1a2e', '#262045'], deco: '🙈 🎁 🔍' },
  { m: 9, name: 'Little Crawler', emoji: '🐛', about: 'Crawling, pulling up, pincer grasp, waving.', accent: '#15803d', dark: '#86efac', hero: ['#e6f9e9', '#fff7da'], heroDark: ['#16331d', '#3a3414'], deco: '🐛 🍃 🐞' },
  { m: 10, name: 'Stand & Cruise', emoji: '🦒', about: 'Standing with support, cruising along furniture.', accent: '#b45309', dark: '#fcd34d', hero: ['#fff5d6', '#e8f6ff'], heroDark: ['#3a2f14', '#172b3a'], deco: '🦒 🌻 🪜' },
  { m: 11, name: 'Babble & Wave', emoji: '👋', about: 'First words, waving bye-bye, almost walking.', accent: '#9d174d', dark: '#f9a8d4', hero: ['#ffe6f0', '#e8f0ff'], heroDark: ['#3d1a2a', '#1c2540'], deco: '👋 💬 🎉' },
];
export const STAGE_THEMES = [
  { from: 12, to: 24, name: 'Little Walker', emoji: '🚶', about: 'Walking, first words, "me do it!"', accent: '#15803d', dark: '#86efac', hero: ['#e7f9ea', '#e6f3ff'], heroDark: ['#16331d', '#172a3d'], deco: '🚶 🌳 🦆' },
  { from: 24, to: 36, name: 'Busy Toddler', emoji: '🚂', about: 'Running, sentences, pretend play, potty training.', accent: '#b91c1c', dark: '#fca5a5', hero: ['#ffe9e6', '#fff6d8'], heroDark: ['#3d1c1a', '#3a3214'], deco: '🚂 🧱 🎈' },
  { from: 36, to: 60, name: 'Little Artist', emoji: '🎨', about: 'Imagination, friends, drawing, endless "why?"', accent: '#7c3aed', dark: '#c4b5fd', hero: ['#f1eaff', '#ffeaf2'], heroDark: ['#271f45', '#3d1a2a'], deco: '🎨 🖍️ 🦄' },
  { from: 60, to: 96, name: 'Early Learner', emoji: '📘', about: 'Reading, school habits, rules and friendships.', accent: '#1d4ed8', dark: '#93c5fd', hero: ['#e8efff', '#eafaf3'], heroDark: ['#18233d', '#15332a'], deco: '📘 ✏️ 🔤' },
  { from: 96, to: 144, name: 'Growing Explorer', emoji: '🚲', about: 'Sports, hobbies, values and study skills.', accent: '#0f766e', dark: '#5eead4', hero: ['#e2f8f4', '#fff1e0'], heroDark: ['#12332f', '#3a2a16'], deco: '🚲 ⚽ 🧭' },
  { from: 144, to: 999, name: 'Young Teen', emoji: '🎧', about: 'Identity, independence and big dreams.', accent: '#4338ca', dark: '#a5b4fc', hero: ['#ebecff', '#f3e8ff'], heroDark: ['#1e2045', '#2a1f45'], deco: '🎧 🚀 🌌' },
];
export function themeFor(months) {
  if (months < 12) return { ...MONTH_THEMES[Math.max(0, Math.floor(months))], label: `Month ${Math.floor(months)}` };
  const s = STAGE_THEMES.find(t => months >= t.from && months < t.to) || STAGE_THEMES[STAGE_THEMES.length - 1];
  return { ...s, label: `${Math.floor(months / 12)} yr${months >= 24 ? 's' : ''}` };
}

// ------------------------------------------------------------------ first-year physical checks
// What most babies are doing physically by the END of each month (paraphrased from CDC/AAP/IAP guidance).
export const MONTHLY_PHYSICAL = [
  { m: 1, growth: 'Gains about 150–200 g a week after the first 2 weeks; back to birth weight by ~2 weeks.', items: ['Lifts head briefly when on tummy', 'Moves both arms and legs equally', 'Brings hands near mouth', 'Startles at loud sounds', 'Focuses on faces 20–30 cm away'] },
  { m: 2, growth: 'About 150–200 g a week; length grows ~3–4 cm a month.', items: ['Holds head up when on tummy (45°)', 'Smoother arm and leg movements', 'Opens and closes hands', 'Follows a moving face or toy with eyes', 'Turns towards sounds'] },
  { m: 3, growth: 'About 150–200 g a week.', items: ['Holds head steady when held upright', 'Pushes up on forearms during tummy time', 'Brings hands together and to mouth', 'Grasps a rattle placed in hand', 'Kicks legs strongly'] },
  { m: 4, growth: 'About 100–150 g a week; head control is good.', items: ['Holds head steady without support', 'Pushes up onto elbows/hands on tummy', 'Rolls from tummy to back', 'Reaches for and swipes at toys', 'Bears some weight on legs when held standing'] },
  { m: 5, growth: 'Birth weight roughly doubles around 4–6 months.', items: ['Rolls both ways (tummy ↔ back)', 'Grabs toys with both hands', 'Moves toys to the mouth', 'Sits with support, head steady', 'Plays with own feet'] },
  { m: 6, growth: 'About 100–150 g a week; ready for solid foods (WHO: from 6 months).', items: ['Sits briefly leaning on hands (tripod)', 'Transfers a toy from one hand to the other', 'Rocks back and forth on hands and knees', 'Supports full weight on legs when held', 'First tooth may appear (6–10 months is common)'] },
  { m: 7, growth: 'About 70–90 g a week from 6–12 months.', items: ['Sits without support', 'Rakes small objects with whole hand', 'Bangs toys together', 'Starts to creep or crawl', 'Drinks sips from a cup held by you'] },
  { m: 8, growth: 'About 70–90 g a week.', items: ['Gets into sitting position by self', 'Crawls (or bottom-shuffles / commando crawls)', 'Starts pincer grasp (thumb and finger)', 'Pulls to stand holding furniture', 'Picks up finger foods'] },
  { m: 9, growth: 'About 70–90 g a week.', items: ['Crawls well', 'Pulls to stand', 'Pincer grasp improving — picks up small pieces', 'Points with index finger', 'Stands holding on'] },
  { m: 10, growth: 'About 70–90 g a week.', items: ['Cruises along furniture', 'Stands holding on with one hand', 'Puts objects into a container', 'Neat pincer grasp', 'Claps hands'] },
  { m: 11, growth: 'About 70–90 g a week.', items: ['Stands alone for a few seconds', 'Walks holding both hands', 'Lets go of objects on purpose', 'Turns pages of a board book (several at once)', 'Feeds self with fingers'] },
  { m: 12, growth: 'Birth weight about triples by 12 months; length grows ~25 cm in the first year.', items: ['Stands alone', 'Takes first steps (9–15 months is normal)', 'Drinks from a cup with help', 'Stacks 2 blocks', 'Has about 4–8 teeth (varies a lot)'] },
];

// ------------------------------------------------------------------ emotional-intelligence roadmap
// Month by month to 3 years, then year by year to 15.
export const EI_ROADMAP = [
  { m: 0, focus: 'Feeling safe', develops: 'Trust that needs will be met', acts: ['Respond quickly to cries', 'Skin-to-skin cuddles', 'Talk softly during feeds'] },
  { m: 1, focus: 'Being soothed', develops: 'Calming with a caregiver (co-regulation)', acts: ['Rock and hum the same lullaby', 'Swaddle / hold close when upset', 'Eye contact during feeds'] },
  { m: 2, focus: 'Social smile', develops: 'Joy in faces and voices', acts: ['Smile back every time', 'Copy coos and wait for a reply', 'Face-to-face play 5 min'] },
  { m: 3, focus: 'Serve & return', develops: 'Back-and-forth "conversations"', acts: ['Reply to every babble', 'Narrate what you are doing', 'Mirror play'] },
  { m: 4, focus: 'Shared joy', develops: 'Laughing together', acts: ['Tickle and laugh games', 'Raspberry blowing', 'Name his happy feelings: "You are so happy!"'] },
  { m: 5, focus: 'Reading faces', develops: 'Noticing happy vs upset expressions', acts: ['Make big happy/sad faces in a mirror', 'Look at baby-face books', 'Name your own feelings aloud'] },
  { m: 6, focus: 'Comfort & routine', develops: 'Security from predictable days', acts: ['Same bedtime routine daily', 'Calm voice during frustration', 'Comfort object (soft toy)'] },
  { m: 7, focus: 'Separation basics', develops: 'Knowing people come back', acts: ['Peek-a-boo many times a day', 'Short goodbye ritual', 'Hide and find toys'] },
  { m: 8, focus: 'Stranger awareness', develops: 'Feeling safe with new people', acts: ['Stay close when meeting new people', 'Let him warm up slowly', 'Name the feeling: "You feel shy"'] },
  { m: 9, focus: 'Naming feelings (by you)', develops: 'Hearing words for emotions', acts: ['Name feelings in daily moments', 'Gently pat & breathe slowly when upset', 'Wave hello and bye-bye together'] },
  { m: 10, focus: 'Gentle touch', develops: 'Early kindness', acts: ['Show "gentle" with pets and babies', 'Praise soft touches', 'Hug a soft toy together'] },
  { m: 11, focus: 'Frustration support', develops: 'Coping when things are hard', acts: ['Help a little, not fully, with hard toys', '"You can do it" encouragement', 'Calmly redirect instead of "No"'] },
  { m: 12, focus: 'Shared attention', develops: 'Pointing to share interest', acts: ['Look where he points and name it', 'Show-and-tell with objects', 'Celebrate his discoveries'] },
  { m: 13, focus: 'Feeling words', develops: 'Understanding happy, sad, angry', acts: ['Feelings picture books', 'Sing "If you\'re happy and you know it"', 'Name feelings in stories'] },
  { m: 14, focus: 'Imitating kindness', develops: 'Copying caring actions', acts: ['Pretend to feed a doll together', 'Model saying "thank you"', 'Let him "help" you'] },
  { m: 15, focus: 'Independence & limits', develops: 'Accepting small "no"s', acts: ['Offer two choices', 'Keep "No" for safety', 'Stay calm through protests'] },
  { m: 16, focus: 'Helping', develops: 'Pride in helping', acts: ['Put toys in a basket together', 'Carry a light item', 'Praise: "You helped!"'] },
  { m: 17, focus: 'Waiting a moment', develops: 'Very early patience', acts: ['"One second" games', 'Count to 3 before giving', 'Sing while waiting for food'] },
  { m: 18, focus: 'Big feelings begin', develops: 'Tantrums are normal — learning to calm with you', acts: ['Stay close and calm in tantrums', 'Validate: "You wanted the ball"', 'Hug once calm'] },
  { m: 19, focus: 'Empathy seeds', develops: 'Noticing others\' upset', acts: ['"Baby is crying — how can we help?"', 'Comfort a doll who "fell"', 'Point out feelings in pictures'] },
  { m: 20, focus: 'Turn-taking', develops: 'Sharing turns with adults', acts: ['Roll a ball back and forth', '"My turn, your turn" games', 'Simple stacking turns'] },
  { m: 21, focus: 'Feelings vocabulary', develops: 'Using a few feeling words', acts: ['Feelings faces cards', 'Ask "Are you happy or sad?"', 'Mirror faces game'] },
  { m: 22, focus: 'Calming tools', develops: 'Starting to self-soothe', acts: ['Teach slow "smell the flower" breath', 'Cosy calm corner', 'Soft toy cuddle when upset'] },
  { m: 23, focus: 'Saying sorry & repair', develops: 'Fixing after hurting someone', acts: ['Model "sorry" and a hug', 'Check on the hurt person together', 'Repair after your own mistakes'] },
  { m: 24, focus: 'Naming own feelings', develops: '"I sad", "I angry"', acts: ['Daily feelings check-in', 'Stories about feelings', 'Praise when he names a feeling'] },
  { m: 25, focus: 'Choices', develops: 'Feeling in control', acts: ['Two choices for clothes, cups, books', 'Warnings before transitions', 'Visual routine pictures'] },
  { m: 26, focus: 'Playing near others', develops: 'Comfort with other children', acts: ['Short playdates', 'Parallel play with blocks', 'Praise gentle play'] },
  { m: 27, focus: 'Frustration tolerance', develops: 'Trying again', acts: ['Puzzles slightly hard', '"Let\'s try another way"', 'Celebrate effort'] },
  { m: 28, focus: 'Empathy in play', develops: 'Caring role-play', acts: ['Doctor play with dolls', 'Feed and comfort toys', '"How does teddy feel?"'] },
  { m: 29, focus: 'Rules & routines', develops: 'Following simple rules', acts: ['Clean-up song', 'One simple house rule at a time', 'Praise following rules'] },
  { m: 30, focus: 'Sharing', develops: 'Starting to share (with help)', acts: ['Timer turns with a toy', 'Share snacks at family time', 'Notice and praise sharing'] },
  { m: 31, focus: 'Fears', develops: 'Coping with fears (dark, dogs)', acts: ['Name the fear calmly', 'Small brave steps', 'Night light & comfort object'] },
  { m: 32, focus: 'Problem-solving', develops: 'Simple solutions to conflicts', acts: ['"What can we do?" questions', 'Puppets act out grabbing vs asking', 'Praise asking nicely'] },
  { m: 33, focus: 'Gratitude', develops: 'Thankfulness', acts: ['"Thank you" at meals', 'Draw a picture for grandparents', 'Gratitude at bedtime'] },
  { m: 34, focus: 'Self-control games', develops: 'Stopping and starting on cue', acts: ['Freeze dance', 'Red light green light', 'Simon says (simple)'] },
  { m: 35, focus: 'Feelings & body', develops: 'Where feelings live in the body', acts: ['"Angry feels hot" talk', 'Drawing feelings', 'Body-relaxing game'] },
  { m: 36, focus: 'Friendship basics', develops: 'Joining play, being kind', acts: ['Role-play "Can I play?"', 'Kindness challenge: one kind act daily', 'Calm-down corner practice'] },
  { y: 4, focus: 'Empathy & friendship', develops: 'Understanding others\' feelings; cooperative play', acts: ['Ask "How does she feel? Why?" in stories', 'Daily kindness act', 'Gratitude at dinner'] },
  { y: 5, focus: 'Self-regulation', develops: 'Calming down with strategies; waiting', acts: ['Feelings thermometer (green/yellow/red)', 'Breathing & counting', 'Board games with turns'] },
  { y: 6, focus: 'Handling losing & mistakes', develops: 'Resilience, growth mindset', acts: ['Play games and lose gracefully', '"I can\'t do it YET"', 'Share your own mistakes'] },
  { y: 7, focus: 'Honesty & responsibility', develops: 'Truth-telling, owning actions', acts: ['Make truth safe — no shaming', 'Small daily chores', 'Talk about fairness'] },
  { y: 8, focus: 'Perspective-taking', develops: 'Seeing situations from others\' view', acts: ['"What would you do?" stories', 'Discuss friendship problems', 'Volunteer together'] },
  { y: 9, focus: 'Managing worry & stress', develops: 'Naming stress, coping skills', acts: ['Worry box / journal', 'Exercise & sleep habits', 'Problem-solving steps'] },
  { y: 10, focus: 'Assertiveness', develops: 'Saying no kindly, standing up for others', acts: ['Role-play peer pressure', 'Practise "I" statements', 'Praise standing up for someone'] },
  { y: 11, focus: 'Digital empathy', develops: 'Kindness and safety online', acts: ['Family media plan', 'Discuss online kindness', 'Think before posting'] },
  { y: 12, focus: 'Self-awareness in puberty', develops: 'Understanding mood changes', acts: ['Talk openly about body & mood changes', 'Journal feelings', 'Keep 1-on-1 time weekly'] },
  { y: 13, focus: 'Healthy relationships', develops: 'Respect, consent, boundaries', acts: ['Discuss respectful friendships', 'Talk about consent', 'Listen more than advise'] },
  { y: 14, focus: 'Identity & values', develops: 'Own values, purpose', acts: ['Discuss values in films/news', 'Encourage service/volunteering', 'Respect his opinions'] },
  { y: 15, focus: 'Independent coping & goals', develops: 'Handling pressure, setting goals', acts: ['Help him set and review goals', 'Exam-stress strategies', 'Know when to seek help'] },
];
export function eiRowFor(months) {
  if (months < 37) return EI_ROADMAP.find(r => r.m === Math.floor(months));
  const y = Math.min(15, Math.floor(months / 12) + 1); // row "y" covers age (y-1) to y years
  return EI_ROADMAP.find(r => r.y === y) || EI_ROADMAP[EI_ROADMAP.length - 1];
}

// ------------------------------------------------------------------ vaccines: India's Universal Immunization Programme (free at government facilities)
// Source: MoHFW National Immunization Schedule. JE is given only in endemic districts.
export const UIP_VACCINES = [
  { at: 0, label: 'At birth', name: 'BCG, OPV-0 (within 15 days), Hepatitis B birth dose (within 24 hours)' },
  { at: 1.5, label: '6 weeks', name: 'OPV-1, Pentavalent-1 (DPT + Hep B + Hib), Rotavirus-1, fIPV-1, PCV-1' },
  { at: 2.5, label: '10 weeks', name: 'OPV-2, Pentavalent-2, Rotavirus-2' },
  { at: 3.5, label: '14 weeks', name: 'OPV-3, Pentavalent-3, Rotavirus-3, fIPV-2, PCV-2' },
  { at: 9, label: '9–12 months', name: 'MR-1 (Measles-Rubella), PCV booster, JE-1*, fIPV-3 (where introduced), Vitamin A (1st dose)' },
  { at: 16, label: '16–24 months', name: 'MR-2, DPT booster-1, OPV booster, JE-2*, Vitamin A (2nd dose)' },
  { at: 24, label: '2–5 years', name: 'Vitamin A every 6 months (3rd to 9th dose)' },
  { at: 60, label: '5–6 years', name: 'DPT booster-2' },
  { at: 120, label: '10 years', name: 'Td (Tetanus & adult Diphtheria)' },
  { at: 192, label: '16 years', name: 'Td' },
];
