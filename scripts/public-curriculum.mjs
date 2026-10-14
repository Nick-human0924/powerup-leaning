import { createHash } from 'node:crypto';

const createdAt = '2026-10-15T00:00:00.000Z';
const materialId = 'DEMO-MATERIAL-INTERACTIVE';
const assetId = 'DEMO-ASSET-CARD';

// Byte-for-byte v1 public artifact. Returning visitors may already hold this
// asset hash, so its ID, path and contents remain immutable.
export const legacyDemoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1260" viewBox="0 0 1000 1260" role="img" aria-labelledby="title description">
  <title id="title">互动演示素材</title>
  <desc id="description">公开合成的英语词汇和礼貌请求示例卡片</desc>
  <rect width="1000" height="1260" rx="48" fill="#f8f6f0"/>
  <rect x="64" y="64" width="872" height="1132" rx="40" fill="#ffffff" stroke="#cddbd1" stroke-width="4"/>
  <circle cx="166" cy="170" r="54" fill="#dceee7"/>
  <path d="M142 176c15-35 48-46 70-15-8 39-39 58-70 15Z" fill="#116b5b"/>
  <text x="244" y="158" fill="#116b5b" font-family="Arial, sans-serif" font-size="46" font-weight="700">互动演示素材</text>
  <text x="244" y="208" fill="#586c65" font-family="Arial, sans-serif" font-size="28">公开合成内容 · 不含教材原页或学习记录</text>
  <text x="110" y="330" fill="#173f37" font-family="Arial, sans-serif" font-size="36" font-weight="700">Words</text>
  <g font-family="Arial, sans-serif" font-size="44" fill="#173f37">
    <text x="130" y="430">apple</text><text x="560" y="430" fill="#586c65">苹果</text>
    <text x="130" y="525">book</text><text x="560" y="525" fill="#586c65">书</text>
    <text x="130" y="620">water</text><text x="560" y="620" fill="#586c65">水</text>
  </g>
  <rect x="104" y="714" width="792" height="310" rx="32" fill="#eaf4ef"/>
  <text x="146" y="790" fill="#116b5b" font-family="Arial, sans-serif" font-size="32" font-weight="700">Polite request</text>
  <text x="146" y="875" fill="#173f37" font-family="Arial, sans-serif" font-size="40">Can I have some water,</text>
  <text x="146" y="932" fill="#173f37" font-family="Arial, sans-serif" font-size="40">please?</text>
  <text x="110" y="1110" fill="#8d5c28" font-family="Arial, sans-serif" font-size="26">Synthetic demo card created for the public interface preview.</text>
</svg>\n`;

export const publicDemoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1260" viewBox="0 0 1000 1260" role="img" aria-labelledby="title description">
  <title id="title">互动演示素材</title>
  <desc id="description">公开合成的 Hello 与 Unit 1 到 Unit 7 英语主题练习目录卡</desc>
  <rect width="1000" height="1260" rx="48" fill="#f8f6f0"/>
  <rect x="64" y="64" width="872" height="1132" rx="40" fill="#ffffff" stroke="#cddbd1" stroke-width="4"/>
  <circle cx="166" cy="170" r="54" fill="#dceee7"/>
  <path d="M142 176c15-35 48-46 70-15-8 39-39 58-70 15Z" fill="#116b5b"/>
  <text x="244" y="158" fill="#116b5b" font-family="Arial, sans-serif" font-size="46" font-weight="700">互动演示素材</text>
  <text x="244" y="208" fill="#586c65" font-family="Arial, sans-serif" font-size="28">公开原创示例 · 不含教材原页或学习记录</text>
  <text x="110" y="302" fill="#173f37" font-family="Arial, sans-serif" font-size="31" font-weight="700">Original thematic exercise catalog</text>
  <g font-family="Arial, sans-serif" font-size="27" fill="#173f37">
    <text x="126" y="376"><tspan font-weight="700">Hello</tspan><tspan fill="#586c65">  greetings · name · age · colours</tspan></text>
    <text x="126" y="448"><tspan font-weight="700">Unit 1</tspan><tspan fill="#586c65">  school · positions · singular/plural</tspan></text>
    <text x="126" y="520"><tspan font-weight="700">Unit 2</tspan><tspan fill="#586c65">  family · appearance · have got</tspan></text>
    <text x="126" y="592"><tspan font-weight="700">Unit 3</tspan><tspan fill="#586c65">  farm · animals · has got</tspan></text>
    <text x="126" y="664"><tspan font-weight="700">Unit 4</tspan><tspan fill="#586c65">  food · preferences · polite requests</tspan></text>
    <text x="126" y="736"><tspan font-weight="700">Unit 5</tspan><tspan fill="#586c65">  birthday · toys · possessives · wants</tspan></text>
    <text x="126" y="808"><tspan font-weight="700">Unit 6</tspan><tspan fill="#586c65">  outing · transport · places · there is/are</tspan></text>
    <text x="126" y="880"><tspan font-weight="700">Unit 7</tspan><tspan fill="#586c65">  sports · actions · permission</tspan></text>
  </g>
  <rect x="104" y="946" width="792" height="150" rx="28" fill="#eaf4ef"/>
  <text x="142" y="1004" fill="#116b5b" font-family="Arial, sans-serif" font-size="29" font-weight="700">Example activity types</text>
  <text x="142" y="1054" fill="#173f37" font-family="Arial, sans-serif" font-size="27">Vocabulary clues · Contextual speaking prompts</text>
  <text x="110" y="1158" fill="#8d5c28" font-family="Arial, sans-serif" font-size="25">Synthetic overview for the public interface preview.</text>
</svg>\n`;

const unitSpecs = [
  {
    id: 'DEMO-U0-HELLO', pageId: 'DEMO-PAGE-U0-HELLO', sectionId: 'DEMO-SECTION-U0-HELLO', order: 0,
    title: 'Hello · 认识新朋友', sectionTitle: '问候、姓名、年龄与颜色',
    vocabulary: ['red', 'blue', 'yellow', 'green'],
    expressions: ['Hello!', 'My name is Mia.', "What's your name?", "I'm seven."],
    goal: '能问候新朋友，交流姓名和年龄，并说出常见颜色。',
    items: [
      ['HELLO', 'Hello!', 'target_expression', 'Hello!', '在见面时主动问候', 'You meet a new classmate in the morning. What can you say first?', ['Hello!', 'Hello'], '先让孩子自己想一句简短问候。'],
      ['MY-NAME', '介绍自己的名字', 'target_expression', 'My name is Mia.', '用完整句介绍自己的名字', 'A new friend asks who you are. Answer with your name.', ['My name is Mia.', "I'm Mia."], '可以把 Mia 换成孩子自己的名字。'],
      ['ASK-NAME', '询问名字', 'target_expression', "What's your name?", '礼貌询问新朋友的名字', 'You want to learn what a new classmate is called. What can you ask?', ["What's your name?"], '提示这是一个以 What 开头的问题。'],
      ['AGE-SEVEN', '表达年龄', 'target_expression', "I'm seven.", '用完整句表达年龄', 'A friend asks your age. Answer as a seven-year-old.', ["I'm seven.", 'I am seven.'], '提示先说 I am 或缩写形式。'],
      ['RED', 'red', 'vocabulary', 'red', '说出常见颜色“红色”', 'Which colour do you see on a ripe tomato?', ['red'], '提示首音是 /r/。'],
      ['BLUE', 'blue', 'vocabulary', 'blue', '说出常见颜色“蓝色”', 'Which colour matches a clear daytime sky?', ['blue'], '提示首音是 /b/。'],
      ['YELLOW', 'yellow', 'vocabulary', 'yellow', '说出常见颜色“黄色”', 'Which colour do you see on a ripe lemon?', ['yellow'], '提示首音是 /j/。'],
      ['GREEN', 'green', 'vocabulary', 'green', '说出常见颜色“绿色”', 'Which colour do you see on fresh grass?', ['green'], '提示首音是 /g/。'],
    ],
  },
  {
    id: 'DEMO-U1', pageId: 'DEMO-PAGE-U1', sectionId: 'DEMO-SECTION-U1', order: 1,
    title: 'Unit 1 · 我们的新学校', sectionTitle: '学校物品、位置与单复数',
    vocabulary: ['pencil', 'ruler', 'chair', 'desk'],
    expressions: ['Where is the pencil?', 'It is under the desk.', 'This is a chair.', 'These are rulers.'],
    goal: '能说出学校物品，描述位置，并区分单数和复数。',
    items: [
      ['PENCIL', 'pencil', 'vocabulary', 'pencil', '说出常见文具“铅笔”', 'What do you use to write or draw and sharpen when it gets blunt?', ['pencil'], '提示首音是 /p/。'],
      ['RULER', 'ruler', 'vocabulary', 'ruler', '说出常见文具“尺子”', 'What classroom tool helps you measure a straight line?', ['ruler'], '提示首音是 /r/。'],
      ['CHAIR', 'chair', 'vocabulary', 'chair', '说出教室物品“椅子”', 'What classroom object do you sit on?', ['chair'], '提示首音是 /tʃ/。'],
      ['DESK', 'desk', 'vocabulary', 'desk', '说出教室物品“课桌”', 'What classroom object holds your books while you work?', ['desk'], '提示首音是 /d/。'],
      ['WHERE-PENCIL', '询问物品位置', 'target_expression', 'Where is the pencil?', '询问一件文具在哪里', 'Your writing tool is missing. Ask where it is.', ['Where is the pencil?', "Where's the pencil?"], '提示用 Where 开头。'],
      ['UNDER-DESK', '描述在课桌下面', 'target_expression', 'It is under the desk.', '用位置词描述一件物品', 'You spot the missing item below the classroom table. Say where it is.', ['It is under the desk.', "It's under the desk."], '提示位置词表示“在下面”。'],
      ['THIS-CHAIR', '用 this 介绍单数物品', 'target_expression', 'This is a chair.', '用 this 介绍近处的一件物品', 'Point to one seat beside you and identify it.', ['This is a chair.'], '提示只介绍一件近处的物品。'],
      ['THESE-RULERS', '用 these 介绍复数物品', 'target_expression', 'These are rulers.', '用 these 介绍近处的多件物品', 'Point to two measuring tools beside you and identify them.', ['These are rulers.'], '提示要用复数形式。'],
    ],
  },
  {
    id: 'DEMO-U2', pageId: 'DEMO-PAGE-U2', sectionId: 'DEMO-SECTION-U2', order: 2,
    title: 'Unit 2 · 我们一家', sectionTitle: '家庭、外貌与 have got',
    vocabulary: ['mother', 'brother', 'curly hair', 'blue eyes'],
    expressions: ['This is my mother.', 'He has got short hair.', 'She has got blue eyes.', 'Have you got a brother?'],
    goal: '能介绍家人，并用 have got 描述人物外貌。',
    items: [
      ['MOTHER', 'mother', 'vocabulary', 'mother', '说出家庭成员“妈妈”', 'Which family word means a female parent?', ['mother', 'mum'], '提示首音是 /m/。'],
      ['BROTHER', 'brother', 'vocabulary', 'brother', '说出家庭成员“兄弟”', 'Which family word means a boy who has the same parents as you?', ['brother'], '提示首音是 /b/。'],
      ['CURLY-HAIR', 'curly hair', 'vocabulary', 'curly hair', '说出卷发这一外貌特征', 'What do you call hair that forms lots of loops?', ['curly hair'], '提示第一个词首音是 /k/。'],
      ['BLUE-EYES', 'blue eyes', 'vocabulary', 'blue eyes', '说出蓝色眼睛这一外貌特征', 'How can you describe eyes that match the colour of a clear sky?', ['blue eyes'], '提示先说颜色，再说身体部位。'],
      ['THIS-MOTHER', '介绍妈妈', 'target_expression', 'This is my mother.', '用完整句介绍一位家人', 'Show a family photo and introduce your female parent.', ['This is my mother.', 'This is my mum.'], '提示用 This is my 开头。'],
      ['HE-SHORT-HAIR', '描述男孩的短发', 'target_expression', 'He has got short hair.', '用 has got 描述男孩外貌', 'Look at a boy with hair above his ears. Describe him.', ['He has got short hair.', "He's got short hair."], '提示主语是 He。'],
      ['SHE-BLUE-EYES', '描述女孩的眼睛', 'target_expression', 'She has got blue eyes.', '用 has got 描述女孩外貌', 'Look at a girl whose eyes match a clear sky. Describe one feature.', ['She has got blue eyes.', "She's got blue eyes."], '提示主语是 She。'],
      ['HAVE-BROTHER', '询问是否有兄弟', 'target_expression', 'Have you got a brother?', '用 have got 询问家庭成员', 'Ask a new friend whether there is a boy sibling in the family.', ['Have you got a brother?'], '提示以 Have you got 开头。'],
    ],
  },
  {
    id: 'DEMO-U3', pageId: 'DEMO-PAGE-U3', sectionId: 'DEMO-SECTION-U3', order: 3,
    title: 'Unit 3 · 快乐农场', sectionTitle: '农场动物与 has got',
    vocabulary: ['cow', 'duck', 'goat', 'horse'],
    expressions: ['It has got four legs.', "It hasn't got wings.", 'Has it got a tail?', 'The ducks are small.'],
    goal: '能说出农场动物，并描述动物有或没有的特征。',
    items: [
      ['COW', 'cow', 'vocabulary', 'cow', '说出农场动物“奶牛”', 'Which farm animal gives milk and says moo?', ['cow'], '提示首音是 /k/。'],
      ['DUCK', 'duck', 'vocabulary', 'duck', '说出农场动物“鸭子”', 'Which farm animal swims, has a beak, and says quack?', ['duck'], '提示首音是 /d/。'],
      ['GOAT', 'goat', 'vocabulary', 'goat', '说出农场动物“山羊”', 'Which farm animal may have horns and likes climbing?', ['goat'], '提示首音是 /g/。'],
      ['HORSE', 'horse', 'vocabulary', 'horse', '说出农场动物“马”', 'Which farm animal can carry a rider and gallop?', ['horse'], '提示首音是 /h/。'],
      ['FOUR-LEGS', '描述四条腿', 'target_expression', 'It has got four legs.', '用 has got 描述动物身体特征', 'Look at an animal standing on one leg at each corner. Describe what it has.', ['It has got four legs.', "It's got four legs."], '提示用 It has got 开头。'],
      ['NO-WINGS', '描述没有翅膀', 'target_expression', "It hasn't got wings.", '用否定形式描述动物特征', 'Look at a hoofed farm animal that cannot fly. Say what it does not have.', ["It hasn't got wings.", 'It has not got wings.'], '提示使用 has got 的否定形式。'],
      ['ASK-TAIL', '询问尾巴', 'target_expression', 'Has it got a tail?', '询问动物是否有某个特征', 'You can only see the front of an animal. Ask about the body part behind it.', ['Has it got a tail?'], '提示以 Has it got 开头。'],
      ['SMALL-DUCKS', '描述小鸭子', 'target_expression', 'The ducks are small.', '用复数名词和形容词描述动物', 'Several tiny quacking birds are by the pond. Describe them.', ['The ducks are small.'], '提示主语是复数。'],
    ],
  },
  {
    id: 'DEMO-UNIT-DAILY', pageId: 'DEMO-PAGE-CARD', sectionId: 'DEMO-SECTION-DAILY', order: 4,
    title: 'Unit 4 · 和朋友一起吃', sectionTitle: '食物、偏好与礼貌请求',
    vocabulary: ['apple', 'water', 'banana', 'sandwich'],
    expressions: ['Can I have some water, please?', 'I like bananas.', "I don't like sandwiches."],
    goal: '能说出常见食物和饮品，表达偏好，并礼貌提出请求。',
    items: [
      ['APPLE', 'apple', 'vocabulary', 'apple', '用英语说出“苹果”', 'What fruit can be red or green and grows on a tree?', ['apple'], '提示首音是 /æ/。', 'DEMO-SKILL-APPLE', 'DEMO-TASK-APPLE'],
      ['BOOK', 'book', 'vocabulary', 'book', '用英语说出“书”', 'What do you open and read when you want a story?', ['book'], '提示首音是 /b/。', 'DEMO-SKILL-BOOK', 'DEMO-TASK-BOOK'],
      ['WATER', 'water', 'vocabulary', 'water', '用英语说出“水”', 'What do you drink when you are thirsty?', ['water'], '提示首音是 /w/。', 'DEMO-SKILL-WATER', 'DEMO-TASK-WATER'],
      ['REQUEST', '礼貌提出请求', 'target_expression', 'Can I have some water, please?', '在日常情境中礼貌请求喝水', 'You are thirsty after playing outside. Ask politely for a drink.', ['Can I have some water, please?'], ['Can I…', 'Can I have some…'], 'DEMO-SKILL-REQUEST', 'DEMO-TASK-REQUEST'],
      ['BANANA', 'banana', 'vocabulary', 'banana', '说出常见水果“香蕉”', 'Which long yellow fruit do you peel before eating?', ['banana'], '提示首音是 /b/。'],
      ['SANDWICH', 'sandwich', 'vocabulary', 'sandwich', '说出常见食物“三明治”', 'What snack has a filling between two slices of bread?', ['sandwich'], '提示首音是 /s/。'],
      ['LIKE-BANANAS', '表达喜欢香蕉', 'target_expression', 'I like bananas.', '用 like 表达喜欢的食物', 'Tell a friend that the long yellow fruit is one of your favourites.', ['I like bananas.'], '提示用 I like 开头。'],
      ['DISLIKE-SANDWICHES', '表达不喜欢三明治', 'target_expression', "I don't like sandwiches.", '用否定形式表达不喜欢的食物', 'Politely tell a friend that filled bread is not one of your favourites.', ["I don't like sandwiches.", 'I do not like sandwiches.'], '提示用 I do not 或缩写形式。'],
    ],
  },
  {
    id: 'DEMO-U5', pageId: 'DEMO-PAGE-U5', sectionId: 'DEMO-SECTION-U5', order: 5,
    title: 'Unit 5 · 生日快乐', sectionTitle: '生日、玩具、所有格与 wants',
    vocabulary: ['doll', 'kite', 'robot', 'ball'],
    expressions: ['Whose kite is this?', "It is Sam's.", 'She wants a doll.', "He doesn't want a robot."],
    goal: '能说出玩具，询问物品属于谁，并表达他人的愿望。',
    items: [
      ['DOLL', 'doll', 'vocabulary', 'doll', '说出玩具“玩偶”', 'Which toy looks like a small person and can wear tiny clothes?', ['doll'], '提示首音是 /d/。'],
      ['KITE', 'kite', 'vocabulary', 'kite', '说出玩具“风筝”', 'Which toy flies on a string when the wind blows?', ['kite'], '提示首音是 /k/。'],
      ['ROBOT', 'robot', 'vocabulary', 'robot', '说出玩具“机器人”', 'Which toy machine may walk, flash, or make electronic sounds?', ['robot'], '提示首音是 /r/。'],
      ['BALL', 'ball', 'vocabulary', 'ball', '说出玩具“球”', 'Which round toy can you throw, catch, or kick?', ['ball'], '提示首音是 /b/。'],
      ['WHOSE-KITE', '询问风筝属于谁', 'target_expression', 'Whose kite is this?', '用 whose 询问物品的主人', 'You find a flying toy after the party. Ask who owns it.', ['Whose kite is this?'], '提示用 Whose 开头。'],
      ['SAMS', '表达物品属于 Sam', 'target_expression', "It is Sam's.", '用所有格表达物品归属', 'Sam points to the toy and says it belongs to him. Explain whose it is.', ["It is Sam's.", "It's Sam's."], '提示在人名后加表示所属的形式。'],
      ['SHE-WANTS-DOLL', '表达女孩想要玩偶', 'target_expression', 'She wants a doll.', '用 wants 表达他人的愿望', 'A girl chooses the toy that looks like a small person. Say what she would like.', ['She wants a doll.'], '提示主语是 She，动词要变化。'],
      ['HE-NOT-ROBOT', '表达男孩不想要机器人', 'target_expression', "He doesn't want a robot.", '用否定形式表达他人的愿望', 'A boy turns down the toy machine. Say what he would not like.', ["He doesn't want a robot.", 'He does not want a robot.'], '提示主语是 He，使用否定形式。'],
    ],
  },
  {
    id: 'DEMO-U6', pageId: 'DEMO-PAGE-U6', sectionId: 'DEMO-SECTION-U6', order: 6,
    title: 'Unit 6 · 一起出游', sectionTitle: '交通、地点、there is/are 与 Let’s',
    vocabulary: ['bus', 'train', 'park', 'zoo'],
    expressions: ['There is a bus.', 'There are two trains.', "Let's go by bus.", "Let's go to the park."],
    goal: '能说出交通工具和地点，描述所见事物，并提出出游建议。',
    items: [
      ['BUS', 'bus', 'vocabulary', 'bus', '说出交通工具“公共汽车”', 'Which large road vehicle carries many people and stops along a route?', ['bus'], '提示首音是 /b/。'],
      ['TRAIN', 'train', 'vocabulary', 'train', '说出交通工具“火车”', 'Which long vehicle travels on rails between stations?', ['train'], '提示首音是 /tr/。'],
      ['PARK', 'park', 'vocabulary', 'park', '说出地点“公园”', 'Which outdoor place has grass, paths, and space to play?', ['park'], '提示首音是 /p/。'],
      ['ZOO', 'zoo', 'vocabulary', 'zoo', '说出地点“动物园”', 'Which place can you visit to see animals from around the world?', ['zoo'], '提示首音是 /z/。'],
      ['THERE-IS-BUS', '描述一辆公共汽车', 'target_expression', 'There is a bus.', '用 there is 描述一个事物', 'Look down the road and describe the single large passenger vehicle you can see.', ['There is a bus.', "There's a bus."], '提示只有一个事物。'],
      ['THERE-ARE-TRAINS', '描述两列火车', 'target_expression', 'There are two trains.', '用 there are 描述多个事物', 'At the station, you can see a pair of rail vehicles. Describe the scene.', ['There are two trains.'], '提示有两个事物，要用复数。'],
      ['LETS-BY-BUS', '建议乘公共汽车', 'target_expression', "Let's go by bus.", '用 Let’s 提出交通建议', 'Your group needs a road vehicle for the trip. Make a suggestion.', ["Let's go by bus."], '提示用 Let us 的缩写开头。'],
      ['LETS-PARK', '建议去公园', 'target_expression', "Let's go to the park.", '用 Let’s 提出地点建议', 'Your friends want grass and space to play. Suggest a destination.', ["Let's go to the park."], '提示先提出“一起去”的建议。'],
    ],
  },
  {
    id: 'DEMO-U7', pageId: 'DEMO-PAGE-U7', sectionId: 'DEMO-SECTION-U7', order: 7,
    title: 'Unit 7 · 一起运动', sectionTitle: '运动、现在进行时与请求许可',
    vocabulary: ['football', 'basketball', 'swimming', 'tennis'],
    expressions: ['He is running.', 'They are playing football.', 'Can I play?', 'Yes, you can.'],
    goal: '能说出运动，描述正在发生的动作，并询问是否可以参加。',
    items: [
      ['FOOTBALL', 'football', 'vocabulary', 'football', '说出运动“足球”', 'Which sport uses a round ball, goals, and mostly your feet?', ['football'], '提示首音是 /f/。'],
      ['BASKETBALL', 'basketball', 'vocabulary', 'basketball', '说出运动“篮球”', 'Which sport asks players to throw a large round object through a high hoop?', ['basketball'], '提示首音是 /b/。'],
      ['SWIMMING', 'swimming', 'vocabulary', 'swimming', '说出运动“游泳”', 'Which sport moves your body through water?', ['swimming'], '提示首音是 /sw/。'],
      ['TENNIS', 'tennis', 'vocabulary', 'tennis', '说出运动“网球”', 'Which sport uses rackets and a net on a court?', ['tennis'], '提示首音是 /t/。'],
      ['HE-RUNNING', '描述男孩正在跑', 'target_expression', 'He is running.', '用现在进行时描述男孩动作', 'A boy is moving quickly on foot right now. Describe what he is doing.', ['He is running.', "He's running."], '提示主语是 He，动作正在发生。'],
      ['THEY-FOOTBALL', '描述多人正在踢足球', 'target_expression', 'They are playing football.', '用现在进行时描述多人运动', 'Several children are kicking a round object towards goals right now. Describe them.', ['They are playing football.', "They're playing football."], '提示主语是 They，动作正在发生。'],
      ['CAN-I-PLAY', '请求加入游戏', 'target_expression', 'Can I play?', '用 can 请求参加活动', 'Your friends have started a game. Ask for permission to join.', ['Can I play?', 'Can I join in?'], '提示用 Can I 开头。'],
      ['YES-CAN', '同意参加', 'target_expression', 'Yes, you can.', '用 can 回应许可请求', 'A friend asks permission to join and you agree. What do you say?', ['Yes, you can.'], '提示先肯定，再使用 can 回应。'],
    ],
  },
];

function normalizeBasePath(value) {
  const normalized = `/${String(value ?? '/powerup-leaning').trim().replace(/^\/+|\/+$/gu, '')}`;
  return normalized === '/' ? '' : normalized;
}

function makeSkill(unit, item) {
  const [key, title, type, expression, goal, , , , skillId] = item;
  const legacyEvidence = {
    APPLE: '公开合成演示卡：Words 区域的 apple。',
    BOOK: '公开合成演示卡：Words 区域的 book。',
    WATER: '公开合成演示卡：Words 区域的 water。',
    REQUEST: '公开合成演示卡：Polite request 区域。',
  };
  const evidence = unit.id === 'DEMO-UNIT-DAILY'
    ? legacyEvidence[key] ?? '由公开合成 v1 日常词汇与礼貌请求情境延伸的原创演示技能；不对应商业教材原页或印刷页码。'
    : `${unit.title} 的公开合成主题页；该技能为原创互动演示内容，不对应商业教材原页或印刷页码。`;
  return {
    id: skillId ?? `${unit.id}-SKILL-${key}`,
    title,
    unit_id: unit.id,
    type,
    canonical_expression: expression,
    ...(type === 'vocabulary' ? { words: [expression] } : {}),
    goal,
    source_page_ids: [unit.pageId],
    origin: 'derived',
    review_status: 'verified',
    version: 1,
    source_evidence: evidence,
    confidence: 1,
  };
}

function makeTask(unit, item, skill) {
  const [key, , , , , prompt, expectedAnswers, hintInput, , taskId] = item;
  const hints = Array.isArray(hintInput) ? hintInput : [hintInput];
  return {
    id: taskId ?? `${unit.id}-TASK-${key}`,
    skill_ids: [skill.id],
    prompt,
    parent_instruction: '只读英文问题，先让孩子独立回答；需要时再逐级提示，不要先展示目标答案。',
    expected_answers: expectedAnswers,
    hint_levels: hints,
    scenario: `${unit.sectionTitle}的原创口语练习`,
    estimated_seconds: 45,
    origin: 'derived',
    source_page_ids: [unit.pageId],
    version: 1,
  };
}

/** @returns {import('../src/lib/schema').Snapshot} */
export function createPublicDemoSnapshot(basePath = '/powerup-leaning') {
  const normalizedBasePath = normalizeBasePath(basePath);
  const legacyPreviewRef = `${normalizedBasePath}/demo/demo-source.svg`;
  const curriculumPreviewRef = `${normalizedBasePath}/demo/curriculum.svg`;
  const legacyHash = createHash('sha256').update(legacyDemoSvg).digest('hex');
  const curriculumHash = createHash('sha256').update(publicDemoSvg).digest('hex');
  const units = unitSpecs.map((unit) => ({
    id: unit.id,
    material_id: materialId,
    title: unit.title,
    printed_page_range: null,
    source_page_ids: [unit.pageId],
    review_status: 'verified',
    order: unit.order,
    reference_outline: {
      vocabulary: unit.vocabulary,
      expressions: unit.expressions,
      goal: unit.goal,
      source_ref: '公开原创互动演示练习；不对应任何商业教材、真实教材页或印刷页码。',
    },
  }));
  const pages = unitSpecs.map((unit) => {
    const isLegacyPage = unit.id === 'DEMO-UNIT-DAILY';
    return ({
    id: unit.pageId,
    asset_id: isLegacyPage ? assetId : 'DEMO-ASSET-CURRICULUM',
    pdf_page_index: null,
    printed_page_number: null,
    unit_id: unit.id,
    printed_page_status: 'not_present',
    ocr_printed_page_candidate: null,
    printed_page_evidence: isLegacyPage ? '公开合成卡片没有教材印刷页码。' : '公开合成主题页没有教材印刷页码。',
    page_preview_ref: isLegacyPage ? legacyPreviewRef : curriculumPreviewRef,
    ocr_status: 'not_needed',
    source_confidence: 1,
    content_hash: isLegacyPage ? legacyHash : curriculumHash,
    extracted_text: isLegacyPage
      ? 'apple | book | water | Can I have some water, please?'
      : `${unit.title} | ${unit.sectionTitle} | original synthetic public demo exercises`,
  });
  });
  const sections = unitSpecs.map((unit) => ({
    id: unit.sectionId,
    unit_id: unit.id,
    material_id: materialId,
    title: unit.sectionTitle,
    printed_page_range: null,
    source_page_ids: [unit.pageId],
    section_type: 'synthetic_demo',
    review_status: 'verified',
  }));
  const skills = [];
  const tasks = [];
  for (const unit of unitSpecs) for (const item of unit.items) {
    const skill = makeSkill(unit, item);
    skills.push(skill);
    tasks.push(makeTask(unit, item, skill));
  }
  /** @type {import('../src/lib/schema').Snapshot} */
  const snapshot = {
    schema_version: '1.0.0',
    materials: [{ id: materialId, title: '互动演示素材', level: '公开示例', edition: '合成内容 v2', publisher: 'Andy English Companion Demo', created_at: createdAt, source_kind: 'manual', review_status: 'verified' }],
    assets: [
      { id: assetId, material_id: materialId, filename: 'demo-source.svg', file_hash: legacyHash, mime: 'image/svg+xml', storage_ref: legacyPreviewRef, uploaded_at: createdAt },
      { id: 'DEMO-ASSET-CURRICULUM', material_id: materialId, filename: 'curriculum.svg', file_hash: curriculumHash, mime: 'image/svg+xml', storage_ref: curriculumPreviewRef, uploaded_at: createdAt },
    ],
    pages,
    units,
    sections,
    skills,
    tasks,
    lessons: [],
    sessions: [],
    observations: [],
    notes: [],
    audio: [],
    jobs: [],
    audit: [
      { id: 'public-demo-v1', timestamp: createdAt, action: 'synthetic_public_demo_created', entity_id: materialId, detail: 'Synthetic public demonstration data only; contains no textbook pages, lesson history, observations, notes, or audio.' },
      { id: 'public-demo-catalog-v2', timestamp: createdAt, action: 'synthetic_public_curriculum_expanded', entity_id: materialId, detail: 'Original public demonstration exercises expanded to Hello and Units 1-7; no private textbook content or personal history.' },
    ],
  };
  validatePublicDemoSnapshot(snapshot);
  return snapshot;
}

function validatePublicDemoSnapshot(value) {
  const collections = ['materials', 'assets', 'pages', 'units', 'sections', 'skills', 'tasks', 'lessons', 'sessions', 'observations', 'notes', 'audio', 'jobs', 'audit'];
  if (value.schema_version !== '1.0.0') throw new Error('Demo seed schema version is invalid.');
  for (const name of collections) if (!Array.isArray(value[name])) throw new Error(`Demo seed collection is missing: ${name}`);
  const ids = new Set();
  for (const name of collections) for (const row of value[name]) {
    if (!row.id || ids.has(row.id)) throw new Error(`Demo seed has an invalid or duplicate id: ${row.id}`);
    ids.add(row.id);
  }
  const has = (name, id) => value[name].some((row) => row.id === id);
  for (const asset of value.assets) if (!has('materials', asset.material_id)) throw new Error(`Broken demo asset reference: ${asset.id}`);
  for (const page of value.pages) if (!has('assets', page.asset_id) || (page.unit_id && !has('units', page.unit_id))) throw new Error(`Broken demo page reference: ${page.id}`);
  for (const unit of value.units) if (!has('materials', unit.material_id) || unit.source_page_ids.some((id) => !has('pages', id))) throw new Error(`Broken demo unit reference: ${unit.id}`);
  for (const section of value.sections) if (!has('units', section.unit_id) || !has('materials', section.material_id) || section.source_page_ids.some((id) => !has('pages', id))) throw new Error(`Broken demo section reference: ${section.id}`);
  for (const skill of value.skills) if (!has('units', skill.unit_id) || skill.origin !== 'derived' || skill.source_page_ids.some((id) => !has('pages', id))) throw new Error(`Broken demo skill reference or origin: ${skill.id}`);
  for (const task of value.tasks) if (task.skill_ids.some((id) => !has('skills', id)) || task.source_page_ids.some((id) => !has('pages', id))) throw new Error(`Broken demo task reference: ${task.id}`);
  for (const unit of value.units) {
    const unitSkills = value.skills.filter((skill) => skill.unit_id === unit.id);
    if (unitSkills.length < 8) throw new Error(`Public demo unit has fewer than eight skills: ${unit.id}`);
    if (unit.printed_page_range !== null) throw new Error(`Synthetic demo unit must not claim printed pages: ${unit.id}`);
    for (const skill of unitSkills) if (!value.tasks.some((task) => task.skill_ids.includes(skill.id))) throw new Error(`Public demo skill has no executable task: ${skill.id}`);
  }
  for (const task of value.tasks) for (const answer of task.expected_answers) {
    const normalizedPrompt = task.prompt.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/gu, ' ').trim();
    const normalizedAnswer = answer.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/gu, ' ').trim();
    if (normalizedAnswer && normalizedPrompt.includes(normalizedAnswer)) throw new Error(`Demo task prompt reveals its answer: ${task.id}`);
  }
  if (value.audit[0]?.id !== 'public-demo-v1' || !value.audit.some((row) => row.id === 'public-demo-catalog-v2')) throw new Error('Public demo audit markers are invalid.');
  if (value.lessons.length || value.sessions.length || value.observations.length || value.notes.length || value.audio.length || value.jobs.length) throw new Error('Public demo seed must not contain learning or personal history.');
  const serialized = JSON.stringify(value).toLowerCase();
  for (const forbidden of ['power up', 'pupil_s book', 'parent_report', 'local-file:', 'private-file:', 'textbook-pages']) {
    if (serialized.includes(forbidden)) throw new Error(`Public demo seed contains forbidden private/source marker: ${forbidden}`);
  }
}
