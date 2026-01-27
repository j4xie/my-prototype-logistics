import jieba
from typing import List, Dict
from collections import Counter

def extract_keywords(inputs: List[str], min_frequency: int = 2, top_n: int = 10) -> List[str]:
    """Extract keywords from user inputs using jieba segmentation."""
    if not inputs:
        return []

    # Combine all inputs
    all_words = []
    for text in inputs:
        if text:
            words = jieba.lcut(text)
            # Filter: length >= 2, not pure punctuation/numbers
            filtered = [w for w in words if len(w) >= 2 and not _is_stopword(w)]
            all_words.extend(filtered)

    # Count frequencies
    word_counts = Counter(all_words)

    # Filter by min frequency and get top N
    filtered_counts = [(word, count) for word, count in word_counts.items() if count >= min_frequency]
    sorted_words = sorted(filtered_counts, key=lambda x: x[1], reverse=True)

    return [word for word, _ in sorted_words[:top_n]]

def _is_stopword(word: str) -> bool:
    """Check if word is a stopword or should be filtered."""
    stopwords = {
        '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
        '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
        '自己', '这', '那', '什么', '吗', '怎么', '这个', '那个', '哪个', '为什么',
        '可以', '能', '想', '请', '帮', '帮我', '我要', '我想', '给我', '让我',
    }

    # Check if pure punctuation or number
    if word.isdigit():
        return True
    if all(c in '，。！？、；：""''【】（）《》' for c in word):
        return True

    return word in stopwords

def add_custom_words(words: List[str]):
    """Add custom words to jieba dictionary for better segmentation."""
    for word in words:
        jieba.add_word(word)

def extract_keywords_with_pos(inputs: List[str], pos_filter: List[str] = None, top_n: int = 10) -> List[Dict]:
    """Extract keywords with part-of-speech tagging."""
    import jieba.posseg as pseg

    if not inputs:
        return []

    if pos_filter is None:
        pos_filter = ['n', 'v', 'vn', 'nz', 'ns', 'nr']  # nouns, verbs, etc.

    word_counts = Counter()

    for text in inputs:
        if text:
            words = pseg.lcut(text)
            for word, flag in words:
                if len(word) >= 2 and flag in pos_filter and not _is_stopword(word):
                    word_counts[word] += 1

    sorted_words = word_counts.most_common(top_n)

    return [{"word": word, "count": count} for word, count in sorted_words]
