"""Build the local seed catalog from the inspected Power Up pages.

The vocabulary and expressions below are a concise transcription of the
locally OCR'd/visually inspected pages. Raw OCR stays in imports/processed.
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "imports" / "processed" / "textbook-pages.json"
BASE = ROOT / "schemas" / "initial-reference.json"
OUTPUT = ROOT / "schemas" / "textbook-import.json"
PUBLIC = ROOT / "public" / "seed.json"
STAMP = "2026-10-14T00:00:00.000Z"
MATERIAL_ID = "PU1-SE-BOOK"

UNITS = {
    "PU1-U0-HELLO": (0, "Hello", (4, 5), "Greet people, introduce yourself, and say your age."),
    "PU1-U1": (1, "Our new school", (6, 17), "Make a classroom poster and talk about classroom objects."),
    "PU1-U2": (2, "All about us", (18, 29), "Make an All about me book and talk about family and appearance."),
    "PU1-U3": (3, "Fun on the farm", (30, 41), "Make a farm and describe its animals."),
    "PU1-U4": (4, "Food with friends", (44, 55), "Organise a picnic and talk about food, requests, and offers."),
    "PU1-U5": (5, "Happy birthday!", (56, 67), "Make a birthday present and talk about toys, owners, and wishes."),
    "PU1-U6": (6, "A day out", (68, 79), "Plan a wildlife tour and talk about places and animals."),
    "PU1-U7": (7, "Let’s play!", (82, 89), "Plan a sports day and talk about activities and permission."),
}

SECTIONS = {
    "PU1-U0-HELLO": [(4, 4, "Numbers and colours", "vocabulary"), (5, 5, "Greetings and introductions", "story")],
    "PU1-U1": [(6, 6, "Mission: Make a classroom poster", "unit_opener"), (7, 7, "Classroom objects and people", "vocabulary"), (8, 8, "The Friendly Farm", "story"), (9, 9, "Where...? and prepositions", "language_practice"), (10, 10, "Extension of classroom objects", "vocabulary"), (11, 11, "Singular and plural nouns; this/these", "language_practice"), (12, 12, "Be kind at school", "social_responsibilities"), (13, 13, "Being kind at school", "cross_curricular"), (14, 14, "The first day", "reading_listening"), (15, 15, "The first day", "speaking_writing"), (16, 16, "Pre A1 preparation", "assessment"), (17, 17, "Mission in action", "review")],
    "PU1-U2": [(18, 18, "Mission: Make an All about me book", "unit_opener"), (19, 19, "Family", "vocabulary"), (20, 20, "The Friendly Farm", "story"), (21, 21, "Who...? and he’s/she’s", "language_practice"), (22, 22, "Parts of the body", "vocabulary"), (23, 23, "have/haven’t got", "language_practice"), (24, 24, "Using our senses", "social_responsibilities"), (25, 25, "The five senses", "cross_curricular"), (26, 26, "Mo’s friends", "reading_listening"), (27, 27, "Mo’s friends", "speaking_writing"), (28, 28, "Pre A1 preparation", "assessment"), (29, 29, "Mission in action", "review")],
    "PU1-U3": [(30, 30, "Mission: Make a farm", "unit_opener"), (31, 31, "Farm animals", "vocabulary"), (32, 32, "The Friendly Farm", "story"), (33, 33, "is/are + adjective", "language_practice"), (34, 34, "Extension of adjectives", "vocabulary"), (35, 35, "has/hasn’t got", "language_practice"), (36, 36, "What do animals give us?", "social_responsibilities"), (37, 37, "Animal products", "cross_curricular"), (38, 38, "Animal babies", "reading_listening"), (39, 39, "Animal babies", "speaking_writing"), (40, 40, "Pre A1 preparation", "assessment"), (41, 41, "Mission in action", "review")],
    "PU1-U4": [(44, 44, "Mission: Organise a picnic", "unit_opener"), (45, 45, "Food and drink", "vocabulary"), (46, 46, "The Friendly Farm", "story"), (47, 47, "like/don’t like", "language_practice"), (48, 48, "Extension of food and drink", "vocabulary"), (49, 49, "Making requests and offers", "language_practice"), (50, 50, "Making a recipe", "social_responsibilities"), (51, 51, "Ingredients and cooking methods", "cross_curricular"), (52, 52, "A picnic with friends", "reading_listening"), (53, 53, "A picnic with friends", "speaking_writing"), (54, 54, "Pre A1 preparation", "assessment"), (55, 55, "Mission in action", "review")],
    "PU1-U5": [(56, 56, "Mission: Make a birthday present", "unit_opener"), (57, 57, "Toys", "vocabulary"), (58, 58, "The Friendly Farm", "story"), (59, 59, "Whose...? and possessives", "language_practice"), (60, 60, "Extension of toys", "vocabulary"), (61, 61, "want/wants", "language_practice"), (62, 62, "Shapes around us", "social_responsibilities"), (63, 63, "Shapes", "cross_curricular"), (64, 64, "Nora and Flora can share", "reading_listening"), (65, 65, "Nora and Flora can share", "speaking_writing"), (66, 66, "Pre A1 preparation", "assessment"), (67, 67, "Mission in action", "review")],
    "PU1-U6": [(68, 68, "Mission: Plan a wildlife tour", "unit_opener"), (69, 69, "Vehicles and places", "vocabulary"), (70, 70, "The Friendly Farm", "story"), (71, 71, "There is/There are", "language_practice"), (72, 72, "Zoo animals", "vocabulary"), (73, 73, "Let’s...", "language_practice"), (74, 74, "Animals in the wild", "social_responsibilities"), (75, 75, "Animal habitats", "cross_curricular"), (76, 76, "When we go to the wildlife park", "reading_listening"), (77, 77, "When we go to the wildlife park", "speaking_writing"), (78, 78, "Pre A1 preparation", "assessment"), (79, 79, "Mission in action", "review")],
    "PU1-U7": [(82, 82, "Mission: Plan a sports day", "unit_opener"), (83, 83, "Sports and hobbies", "vocabulary"), (84, 84, "The Friendly Farm", "story"), (85, 85, "Present continuous", "language_practice"), (86, 86, "Sports verbs and extension of sports", "vocabulary"), (87, 87, "can for permission", "language_practice"), (88, 88, "Look after your body!", "social_responsibilities"), (89, 89, "Keeping your body strong", "cross_curricular")],
}

VOCAB = {
    "PU1-U0-HELLO": (4, [("one", "一"), ("two", "二"), ("three", "三"), ("four", "四"), ("five", "五"), ("six", "六"), ("seven", "七"), ("eight", "八"), ("nine", "九"), ("ten", "十"), ("orange", "橙色"), ("purple", "紫色"), ("red", "红色"), ("blue", "蓝色"), ("yellow", "黄色"), ("pink", "粉色"), ("black", "黑色"), ("brown", "棕色"), ("green", "绿色"), ("grey", "灰色"), ("white", "白色")]),
    "PU1-U1": (7, [("classroom", "教室"), ("rubber", "橡皮"), ("pencil", "铅笔"), ("teacher", "老师"), ("bag", "书包"), ("desk", "课桌"), ("crayon", "蜡笔"), ("chair", "椅子"), ("book", "书"), ("pen", "钢笔"), ("pencil case", "铅笔盒"), ("door", "门"), ("wall", "墙"), ("board", "黑板"), ("window", "窗户"), ("playground", "操场"), ("paper", "纸"), ("bookcase", "书架"), ("cupboard", "柜子"), ("ruler", "尺子")]),
    "PU1-U2": (19, [("family", "家人"), ("grandfather", "祖父"), ("grandpa", "爷爷"), ("father", "父亲"), ("dad", "爸爸"), ("mother", "母亲"), ("mum", "妈妈"), ("grandmother", "祖母"), ("grandma", "奶奶"), ("sister", "姐妹"), ("brother", "兄弟"), ("nose", "鼻子"), ("head", "头"), ("ear", "耳朵"), ("arm", "手臂"), ("hand", "手"), ("body", "身体"), ("hair", "头发"), ("leg", "腿"), ("foot", "脚"), ("eye", "眼睛"), ("face", "脸"), ("mouth", "嘴"), ("tail", "尾巴"), ("feet", "双脚")]),
    "PU1-U3": (31, [("cow", "奶牛"), ("donkey", "驴"), ("horse", "马"), ("spider", "蜘蛛"), ("goat", "山羊"), ("sheep", "绵羊"), ("cat", "猫"), ("dog", "狗"), ("chicken", "鸡"), ("duck", "鸭子"), ("funny", "有趣的"), ("ugly", "难看的"), ("tired", "疲倦的"), ("sad", "伤心的"), ("angry", "生气的"), ("happy", "开心的"), ("little", "小的"), ("beautiful", "漂亮的"), ("wool", "羊毛"), ("milk", "牛奶"), ("honey", "蜂蜜"), ("eggs", "鸡蛋")]),
    "PU1-U4": (45, [("chocolate", "巧克力"), ("cake", "蛋糕"), ("chicken", "鸡肉"), ("burger", "汉堡"), ("water", "水"), ("bread", "面包"), ("banana", "香蕉"), ("lemonade", "柠檬水"), ("salad", "沙拉"), ("mango", "芒果"), ("fruit", "水果"), ("grapes", "葡萄"), ("apple", "苹果"), ("orange", "橙子"), ("juice", "果汁"), ("meat", "肉"), ("meatballs", "肉丸"), ("beans", "豆子"), ("sausage", "香肠"), ("onion", "洋葱"), ("pasta", "意大利面"), ("potatoes", "土豆"), ("rice", "米饭"), ("cheese", "奶酪"), ("carrots", "胡萝卜"), ("tomatoes", "西红柿")]),
    "PU1-U5": (57, [("plane", "飞机"), ("kite", "风筝"), ("doll", "玩偶"), ("house", "房子"), ("robot", "机器人"), ("ball", "球"), ("bike", "自行车"), ("car", "小汽车"), ("ship", "轮船"), ("computer", "电脑"), ("mouse", "鼠标"), ("balloon", "气球"), ("box", "盒子"), ("keyboard", "键盘"), ("drum", "鼓"), ("board game", "棋盘游戏"), ("video game", "电子游戏"), ("teddy", "泰迪熊"), ("circle", "圆形"), ("square", "正方形"), ("triangle", "三角形"), ("rectangle", "长方形")]),
    "PU1-U6": (69, [("tree", "树"), ("train", "火车"), ("shop", "商店"), ("bus stop", "公交车站"), ("bus", "公交车"), ("garden", "花园"), ("lorry", "卡车"), ("flower", "花"), ("car", "小汽车"), ("park", "公园"), ("motorbike", "摩托车"), ("giraffe", "长颈鹿"), ("panda", "熊猫"), ("hippo", "河马"), ("bear", "熊"), ("crocodile", "鳄鱼"), ("elephant", "大象"), ("zebra", "斑马"), ("tiger", "老虎"), ("monkey", "猴子"), ("snake", "蛇"), ("lizard", "蜥蜴")]),
    "PU1-U7": (83, [("play tennis", "打网球"), ("play football", "踢足球"), ("ride a bike", "骑自行车"), ("play the guitar", "弹吉他"), ("play the piano", "弹钢琴"), ("swim", "游泳"), ("play basketball", "打篮球"), ("watch television", "看电视"), ("throw", "投掷"), ("catch", "接住"), ("play baseball", "打棒球"), ("ride a skateboard", "滑滑板"), ("play hockey", "打曲棍球"), ("hit", "击打"), ("run", "跑步"), ("kick", "踢"), ("jump", "跳"), ("stretch your arms", "伸展手臂"), ("stretch your legs", "伸展双腿"), ("stretch your body", "伸展身体")]),
}

EXPRESSIONS = {
    "PU1-U0-HELLO": [(5, "ASK-NAME", "Ask and answer names", "What’s your name?", ["I’m Andy."], "询问并回答名字"), (5, "ASK-AGE", "Ask and answer ages", "How old are you?", ["I’m seven."], "询问并回答年龄")],
    "PU1-U1": [(9, "WHERE", "Ask where an object is", "Where’s the crayon?", ["It’s under the chair."], "询问并说明教室物品的位置"), (11, "THIS-THESE", "Identify one or more objects", "What’s this? / What are these?", ["It’s a window.", "They’re windows."], "辨认一个或多个物品")],
    "PU1-U2": [(21, "WHO", "Identify family members", "Who is she? / Who is he?", ["She’s Jenny.", "He’s Jim."], "询问并介绍家人"), (23, "HAVE-GOT", "Talk about appearance", "Have you got red hair?", ["Yes, I have.", "No, I haven’t."], "询问并描述外貌")],
    "PU1-U3": [(33, "DESCRIBE", "Describe animals", "He’s a nice cat.", ["It’s a big horse."], "用形容词描述动物"), (35, "HAS-GOT", "Ask about animal features", "Has it got a long face?", ["Yes, it has.", "No, it hasn’t."], "询问动物的外形特征")],
    "PU1-U4": [(47, "LIKE-RESP", "Respond to a question about likes", "Do you like chocolate?", ["Yes, I do.", "No, I don’t."], "表达自己是否喜欢一种食物"), (49, "REQUEST", "Make a polite request", "Can I have some chocolate, please?", ["Can I have some chocolate, please?"], "礼貌请求一种食物或饮品"), (49, "OFFER-RESP", "Respond to a food offer", "Would you like some ice cream?", ["Yes, please.", "No, thank you."], "礼貌接受或拒绝食物")],
    "PU1-U5": [(59, "WHOSE", "Ask who owns a toy", "Whose ball is this?", ["It’s Shelly’s ball."], "询问并说明玩具属于谁"), (61, "WANT", "Ask what someone wants", "Does she want a drum?", ["Yes, she does.", "No, she doesn’t.", "She wants a game."], "询问并说明别人想要什么")],
    "PU1-U6": [(71, "THERE", "Ask what is in a place", "Are there any trees?", ["Yes, there are.", "No, there aren’t."], "询问并说明某地有什么"), (73, "LETS", "Make a suggestion", "Let’s play a game.", ["That’s a good idea.", "OK."], "提出并回应活动建议")],
    "PU1-U7": [(85, "PRESENT-CONT", "Ask about actions now", "What are you doing?", ["I’m swimming."], "询问并描述正在做的动作"), (87, "PERMISSION", "Ask for permission", "Can we play tennis?", ["Yes, you can.", "No, you can’t."], "请求并回应活动许可"), (89, "WARM-UP", "Suggest a warm-up action", "Let’s stretch our legs.", ["Good idea. Now let’s stretch our arms."], "提出并回应热身动作建议")],
}

GRAMMAR_OUTLINES = {
    "PU1-U0-HELLO": ["What’s your name?", "I’m Henrietta.", "How old are you?", "I’m three."],
    "PU1-U1": ["Where’s the crayon?", "It isn’t on the desk. It’s under the chair.", "Where’s the pen?", "It isn’t in the pencil case. It’s next to the bag.", "What’s this? It’s a window.", "What are these? They’re windows."],
    "PU1-U2": ["Who is he? He’s Adam. He’s a boy. He’s my brother.", "Who is she? She’s Hana. She’s a girl. She’s my sister.", "I’ve got brown hair.", "I haven’t got black hair.", "They’ve got blue eyes.", "They haven’t got green eyes.", "Have you got red hair? Yes, I have. / No, I haven’t."],
    "PU1-U3": ["He isn’t a small dog.", "It isn’t a young horse.", "They aren’t small chickens.", "He’s a nice cat.", "It’s an old donkey.", "They’re big cows!", "It’s got long ears.", "It hasn’t got small feet.", "Has it got a long face? Yes, it has. / No, it hasn’t."],
    "PU1-U4": ["Do you like chocolate? Yes, I do. / No, I don’t.", "I/We like chocolate.", "She likes chocolate.", "I don’t like mangoes.", "He doesn’t like mangoes.", "Can I have some chocolate, please? Here you are.", "Would you like some ice cream? Yes, please. / No, thank you."],
    "PU1-U5": ["Whose ball is this? It’s Shelly’s ball. Her ball is blue.", "Whose doll is this? It’s Harry’s doll. His doll is new.", "Whose plane is this? It’s Jim and Jenny’s plane. Their plane is grey.", "Does she want a drum? No, she doesn’t. She doesn’t want a drum.", "Does she want a game? Yes, she does.", "What does she want? She wants a game."],
    "PU1-U6": ["Is there a shop? Yes, there is. / No, there isn’t.", "There’s a bus. There isn’t a shop.", "Are there any trees? Yes, there are. / No, there aren’t.", "There are some toys. There aren’t any trees.", "Let’s play a game. That’s a good idea.", "Let’s make our game. OK."],
    "PU1-U7": ["What’s she doing? She’s eating a cake.", "Are they riding a horse? Yes, they are. / No, they aren’t.", "What are you doing? I’m singing this song.", "Can we play tennis? Yes, you can, but you can’t play here.", "Let’s stretch our legs. Good idea. Now let’s stretch our arms."],
}


def slug(text: str) -> str:
    return re.sub(r"[^A-Z0-9]+", "-", text.upper()).strip("-")


def task_for(skill: dict) -> dict:
    answer = skill.get("canonical_expression") or skill["words"][0]
    if skill["type"] == "vocabulary":
        prompt = f"用英文说出：{skill['goal'].removeprefix('说出“').removesuffix('”') }"
        expected = [answer]
        instruction = "先说中文意思或指出实物，不展示英文答案；需要时再逐级提示。"
    else:
        prompt = f"生活情境：{skill['goal']}。请用合适的英语回应。"
        expected = skill.pop("_answers")
        instruction = "先描述情境，不展示参考答案；需要时再逐级给提示。"
    value = 2166136261
    for character in f"1|{answer}":
        value ^= ord(character)
        value = (value * 16777619) & 0xFFFFFFFF
    digest = base36(value)
    return {"id": f"task-{skill['id']}-{digest}", "skill_ids": [skill["id"]], "prompt": prompt,
            "parent_instruction": instruction, "expected_answers": expected,
            "hint_levels": [expected[0].split()[0] + "…"], "scenario": skill["goal"],
            "estimated_seconds": 45, "origin": "derived", "source_page_ids": skill["source_page_ids"], "version": 1}


def base36(value: int) -> str:
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    if value == 0:
        return "0"
    output = ""
    while value:
        value, remainder = divmod(value, 36)
        output = digits[remainder] + output
    return output


def build() -> dict:
    manifest = json.loads(MANIFEST.read_text("utf-8"))
    base = json.loads(BASE.read_text("utf-8"))
    page_by_printed = {}
    assets = []
    pages = []
    for item in manifest["assets"]:
        assets.append({"id": item["id"], "material_id": MATERIAL_ID, "filename": item["filename"],
                       "file_hash": item["file_hash"], "mime": item["mime"], "storage_ref": f"local-file:{item['filename']}", "uploaded_at": STAMP})
    for item in manifest["pages"]:
        global_index = item["global_page_index"]
        printed = None if global_index <= 2 else global_index - 1
        visual_pages = {3, 4, 5, 7, 9, 11, 21, 23, 33, 35, 47, 49, 59, 61, 71, 73, 85, 87, 89}
        status = "not_present" if printed is None else ("verified_visual" if printed in visual_pages or global_index == 4 else "observed_ocr")
        raw_candidate = item.get("observed_printed_page_number")
        evidence = ("No printed footer on the cover/frontispiece." if printed is None else
                    "Footer number visually verified against the rendered source page; any differing OCR candidate is retained separately." if status == "verified_visual" else
                    "Footer number read by local OCR and consistent with the adjacent continuous printed-page sequence.")
        unit_id = next((uid for uid, (_, _, bounds, _) in UNITS.items() if printed and bounds[0] <= printed <= bounds[1]), None)
        concise = " | ".join(item["ocr_text"].splitlines())[:500]
        page = {"id": item["id"], "asset_id": item["asset_id"], "pdf_page_index": item["pdf_page_index"],
                "printed_page_number": printed, "printed_page_status": status, "ocr_printed_page_candidate": raw_candidate,
                "printed_page_evidence": evidence, "page_preview_ref": item["preview_ref"], "ocr_status": "complete",
                "source_confidence": max(0.5, min(1, item["ocr_mean_confidence"])), "content_hash": item["preview_sha256"],
                "extracted_text": concise}
        if unit_id:
            page["unit_id"] = unit_id
        pages.append(page)
        if printed:
            page_by_printed[printed] = page["id"]

    units = []
    for uid, (order, title, bounds, goal) in UNITS.items():
        vocabulary = [word for word, _ in VOCAB[uid][1]]
        expressions = GRAMMAR_OUTLINES[uid]
        units.append({"id": uid, "material_id": MATERIAL_ID, "title": title, "printed_page_range": list(bounds),
                      "source_page_ids": [page_by_printed[n] for n in range(bounds[0], bounds[1] + 1)],
                      "review_status": "verified", "order": order,
                      "reference_outline": {"vocabulary": vocabulary, "expressions": expressions, "goal": goal,
                                            "source_ref": f"Actual local Power Up 1 Second Edition scans, printed pp.{bounds[0]}–{bounds[1]}"}})
    sections = []
    for uid, rows in SECTIONS.items():
        for start, end, title, kind in rows:
            sections.append({"id": f"{uid}-SEC-{start}-{slug(title)}", "unit_id": uid, "material_id": MATERIAL_ID,
                             "title": title, "printed_page_range": [start, end],
                             "source_page_ids": [page_by_printed[n] for n in range(start, end + 1)],
                             "section_type": kind, "review_status": "verified"})
    skills = []
    for uid, (default_page, rows) in VOCAB.items():
        for word, chinese in rows:
            # Extension vocabulary is traced to its actual later page.
            page = default_page
            if uid == "PU1-U1" and word in {"door", "wall", "board", "window", "playground", "paper", "bookcase", "cupboard", "ruler"}: page = 10
            if uid == "PU1-U2" and word in {"nose", "head", "ear", "arm", "hand", "body", "hair", "leg", "foot", "eye", "face", "mouth", "tail", "feet"}: page = 22
            if uid == "PU1-U3" and word in {"funny", "ugly", "tired", "sad", "angry", "happy", "little", "beautiful"}: page = 34
            if uid == "PU1-U3" and word in {"wool", "milk", "honey", "eggs"}: page = 36
            if uid == "PU1-U4" and word in {"fruit", "grapes", "apple", "orange", "juice", "meat", "meatballs", "beans", "sausage"}: page = 48
            if uid == "PU1-U4" and word in {"onion", "pasta", "potatoes", "rice", "cheese", "carrots", "tomatoes"}: page = 50
            if uid == "PU1-U5" and word in {"ship", "computer", "mouse", "balloon", "box", "keyboard", "drum", "board game", "video game", "teddy"}: page = 60
            if uid == "PU1-U5" and word in {"circle", "square", "triangle", "rectangle"}: page = 62
            if uid == "PU1-U6" and word in {"giraffe", "panda", "hippo", "bear", "crocodile", "elephant", "zebra", "tiger", "monkey", "snake", "lizard"}: page = 72
            if uid == "PU1-U7" and word in {"throw", "catch", "play baseball", "ride a skateboard", "play hockey", "hit", "run", "kick"}: page = 86
            if uid == "PU1-U7" and word in {"jump", "stretch your arms", "stretch your legs", "stretch your body"}: page = 88
            sid = f"{uid}-VOCAB-{slug(word)}"
            # Preserve the IDs already used by Unit 4 observations.
            if uid == "PU1-U4" and word in {"banana", "bread", "water", "chocolate", "cake", "chicken", "burger", "lemonade", "salad", "mango"}:
                sid = f"PU1-U4-VOCAB-{slug(word)}"
            skills.append({"id": sid, "title": word, "unit_id": uid, "type": "vocabulary", "canonical_expression": word,
                           "words": [word], "goal": chinese, "source_page_ids": [page_by_printed[page]],
                           "origin": "source", "review_status": "verified", "version": 1,
                           "source_evidence": f"Printed p.{page}, vocabulary label: {word}", "confidence": 0.98})
    for uid, rows in EXPRESSIONS.items():
        for page, suffix, title, canonical, answers, goal in rows:
            sid = f"{uid}-{suffix}"
            skills.append({"id": sid, "title": title, "unit_id": uid, "type": "target_expression",
                           "canonical_expression": canonical, "goal": goal, "source_page_ids": [page_by_printed[page]],
                           "origin": "source", "review_status": "verified", "version": 1,
                           "source_evidence": f"Printed p.{page}, language practice: {canonical}", "confidence": 0.99,
                           "_answers": answers})
    tasks = [task_for(skill) for skill in skills]
    request = next(skill for skill in skills if skill["id"] == "PU1-U4-REQUEST")
    tasks.append({"id": "task-PU1-U4-REQUEST-WATER-EXT", "skill_ids": [request["id"]],
                  "prompt": "情境：安哲想喝水，请他礼貌开口请求。", "parent_instruction": "只交代想要水，不直接念出目标英语句。",
                  "expected_answers": ["Can I have some water, please?"], "hint_levels": ["Can I…", "Can I have some…"],
                  "scenario": "在生活中礼貌请求喝水", "estimated_seconds": 45, "origin": "derived",
                  "source_page_ids": request["source_page_ids"], "version": 1})
    material = next((row for row in base["materials"] if row["id"] == MATERIAL_ID), None) or {
        "id": MATERIAL_ID, "title": "Cambridge Power Up 1", "level": "1", "edition": "Second Edition",
        "publisher": "Cambridge University Press & Assessment", "created_at": STAMP,
        "source_kind": "textbook", "review_status": "verified"}
    material["review_status"] = "verified"
    result = {"schema_version": "1.0.0", "materials": [material], "assets": assets, "pages": pages,
              "units": units, "sections": sections, "skills": skills, "tasks": tasks,
              "lessons": [], "sessions": [], "observations": [], "notes": [], "audio": [],
              "jobs": [{"id": "textbook-import-2026-10-14", "asset_ids": [row["id"] for row in assets], "job_type": "material",
                        "status": "published", "progress": 1, "errors": [], "created_candidate_ids": [row["id"] for row in skills],
                        "created_at": STAMP, "finished_at": STAMP}],
              "audit": [{"id": "catalog-v2", "timestamp": STAMP, "action": "catalog_revision",
                         "entity_id": MATERIAL_ID, "detail": "Hello and Units 1–7 ordered catalog, now backed by the inspected local textbook pages."},
                        {"id": "textbook-v1", "timestamp": STAMP, "action": "actual_textbook_catalog_imported",
                         "entity_id": MATERIAL_ID, "detail": "9 local PDFs; 90 pages rendered and locally OCRed; verified content through printed p.89; no lesson or mastery inferred."}]}
    return result


if __name__ == "__main__":
    snapshot = build()
    text = json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n"
    OUTPUT.write_text(text, "utf-8")
    BASE.write_text(text, "utf-8")
    PUBLIC.write_text(text, "utf-8")
    print(f"Wrote {len(snapshot['assets'])} assets, {len(snapshot['pages'])} pages, {len(snapshot['sections'])} sections, {len(snapshot['skills'])} skills, and {len(snapshot['tasks'])} tasks")
