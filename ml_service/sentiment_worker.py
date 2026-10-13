#!/usr/bin/env python3
"""
MarketPulse ML Microservice - FinBERT Sentiment Worker
"""
import os
import sys
import re
import argparse
import datetime
from typing import List, Dict, Any
import requests
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv
from transformers import pipeline

# Load environment variables
script_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(script_dir, ".env"))
load_dotenv()

# Hardcoded for reliability based on previous debugging
DB_URL = "postgresql://postgres:data%40dharsh@localhost:5432/marketpulse"
GNEWS_API_KEY = "77c47e126551bedec6644c6cc837572d"

# Global pipelines
_nlp_pipeline = None

def get_sentiment_pipeline():
    global _nlp_pipeline
    if _nlp_pipeline is None:
        print("[FinBERT] Loading 'ProsusAI/finbert' pipeline...")
        _nlp_pipeline = pipeline("text-classification", model="ProsusAI/finbert", top_k=None)
        print("[FinBERT] Model loaded successfully.")
    return _nlp_pipeline

def get_db_connection():
    try:
        return psycopg2.connect(DB_URL)
    except Exception as exc:
        print(f"[Database Error] Could not connect to PostgreSQL: {exc}")
        sys.exit(1)

def passes_entity_filter(headline: str, ticker: str) -> bool:
    if not headline:
        return False
    base_symbol = ticker.split(".")[0].strip().upper()
    
    symbol_aliases = {
        "RELIANCE": ["RELIANCE", "RIL", "MUKESH AMBANI", "JIO"],
        "TCS": ["TCS", "TATA CONSULTANCY"],
        "INFY": ["INFOSYS", "INFY"],
        "HDFCBANK": ["HDFC", "HDFC BANK", "HDFCBANK"],
        "ICICIBANK": ["ICICI", "ICICI BANK"],
        "SBIN": ["SBI", "STATE BANK OF INDIA"],
        "TATAMOTORS": ["TATA MOTORS", "TMCV", "JLR"],
        "WIPRO": ["WIPRO"],
        "ITC": ["ITC"],
        "BHARTIARTL": ["AIRTEL", "BHARTI AIRTEL"]
    }
    
    keywords = symbol_aliases.get(base_symbol, [base_symbol])
    headline_upper = headline.upper()
    for kw in keywords:
        pattern = r"\b" + re.escape(kw) + r"\b"
        if re.search(pattern, headline_upper):
            return True
    return False

def fetch_ticker_news(ticker: str) -> List[Dict[str, Any]]:
    base_symbol = ticker.split(".")[0].strip().upper()
    print(f"[GNews] Fetching live financial news for {ticker} (Symbol: {base_symbol})...")

    if not GNEWS_API_KEY or GNEWS_API_KEY == "your_gnews_api_key_here":
        print("[Warning] GNEWS_API_KEY is missing.")
        return []

    if base_symbol == "HDFCBANK":
        search_query = '"HDFC Bank" OR "HDFCBANK"'
    elif base_symbol == "ICICIBANK":
        search_query = '"ICICI Bank" OR "ICICIBANK"'
    else:
        search_query = f'"{base_symbol}" OR "{base_symbol} Ltd"'

    url = "https://gnews.io/api/v4/search"
    params = {
        "q": search_query,
        "lang": "en",
        "max": 10,
        "apikey": GNEWS_API_KEY,
    }
    
    if ticker.upper().endswith(".NS") or ticker.upper().endswith(".BO"):
        params["country"] = "in"

    try:
        response = requests.get(url, params=params, timeout=12)
    except requests.exceptions.RequestException as exc:
        print(f"[Warning] Network error: {exc}")
        return []

    if response.status_code != 200:
        print(f"[Warning] GNews API request failed with status {response.status_code}: {response.text}")
        return []

    try:
        data = response.json()
    except Exception as exc:
        print(f"[Warning] Failed to parse JSON: {exc}")
        return []

    articles = data.get("articles", [])
    
    if not articles and params.get("country") == "in":
        print("[GNews] No articles found with country='in'. Retrying global search...")
        params_no_country = {k: v for k, v in params.items() if k != "country"}
        try:
            response2 = requests.get(url, params=params_no_country, timeout=12)
            if response2.status_code == 200:
                articles = response2.json().get("articles", [])
        except Exception:
            pass

    if not articles:
        print(f"[GNews] No live articles returned matching query: {search_query}")
        return []

    parsed_articles = []
    for item in articles:
        headline = item.get("title")
        url_link = item.get("url")
        pub_date_str = item.get("publishedAt")

        if not headline:
            continue

        pub_dt = datetime.datetime.now(datetime.timezone.utc)
        if pub_date_str:
            try:
                pub_dt = datetime.datetime.fromisoformat(pub_date_str.replace("Z", "+00:00"))
            except Exception:
                pass

        parsed_articles.append({
            "ticker": ticker.upper(),
            "headline": headline.strip(),
            "source_url": url_link or "https://gnews.io",
            "published_at": pub_dt,
        })

    print(f"[GNews] Successfully fetched {len(parsed_articles)} live news articles.")
    return parsed_articles

def generate_market_impact(headline: str, sentiment: str) -> str:
    headline_lower = headline.lower()
    
    if sentiment.lower() == 'positive':
        if any(word in headline_lower for word in ['profit', 'earnings', 'beat', 'surge', 'jump', 'rally', 'gain']):
            return "Strong financial performance suggests potential upside momentum and increased investor confidence."
        if any(word in headline_lower for word in ['upgrade', 'buy', 'overweight', 'outperform']):
            return "Analyst upgrade indicates institutional confidence and may attract buying interest from retail investors."
        if any(word in headline_lower for word in ['launch', 'new', 'expansion', 'partnership', 'deal']):
            return "Strategic initiative could drive future revenue growth and market share expansion."
        if any(word in headline_lower for word in ['dividend', 'bonus', 'buyback']):
            return "Shareholder-friendly action signals strong cash flow and management confidence in future prospects."
        return "Positive sentiment reflects favorable market perception and potential near-term price appreciation."

    elif sentiment.lower() == 'negative':
        if any(word in headline_lower for word in ['loss', 'downgrade', 'fall', 'drop', 'slump', 'decline']):
            return "Weakening performance may trigger selling pressure and caution among institutional investors."
        if any(word in headline_lower for word in ['probe', 'lawsuit', 'scrutiny', 'regulatory', 'penalty']):
            return "Regulatory or legal concerns pose potential risk to reputation and near-term stock performance."
        if any(word in headline_lower for word in ['selloff', 'cut', 'reduce', 'layoff']):
            return "Cost-cutting measures may indicate operational challenges or weakening market demand."
        if any(word in headline_lower for word in ['monopoly', 'competition', 'rival']):
            return "Competitive pressures or regulatory scrutiny could impact market positioning and margins."
        return "Negative sentiment suggests potential headwinds and increased volatility in the near term."

    else:
        if any(word in headline_lower for word in ['hold', 'neutral', 'maintain']):
            return "Analyst maintains neutral stance, suggesting stock is fairly valued at current levels."
        if any(word in headline_lower for word in ['dividend', 'record date', 'ex-date']):
            return "Routine corporate action with no immediate directional bias on stock price."
        if any(word in headline_lower for word in ['meeting', 'board', 'result', 'announcement']):
            return "Scheduled corporate event provides opportunity for investors to reassess fundamentals."
        if any(word in headline_lower for word in ['holiday', 'closed', 'trading']):
            return "Administrative notice with no material impact on stock valuation or trading activity."
        return "Provides general market context without a strong directional signal for immediate action."

# ==========================================
# THIS IS THE MISSING FUNCTION THAT CAUSED THE ERROR
# ==========================================
def analyze_sentiment(articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not articles:
        return []

    pipe = get_sentiment_pipeline()
    headlines = [a["headline"] for a in articles]

    print(f"[FinBERT] Analyzing {len(headlines)} headlines...")
    raw_results = pipe(headlines)

    enriched_articles = []
    for article, result in zip(articles, raw_results):
        score_map = {item["label"].lower(): float(item["score"]) for item in result}
        pos_prob = score_map.get("positive", 0.0)
        neg_prob = score_map.get("negative", 0.0)
        neu_prob = score_map.get("neutral", 0.0)

        signed_score = round(pos_prob - neg_prob, 4)
        pred_label = max(score_map, key=score_map.get)

        enriched_articles.append({
            **article,
            "sentiment_label": pred_label,
            "signed_score": signed_score,
            "impact_assessment": generate_market_impact(article['headline'], pred_label)
        })

        print(f"  -> '{article['headline'][:50]}...' | Label: {pred_label} | Score: {signed_score:+0.4f}")

    return enriched_articles
# ==========================================

def save_to_database(articles: List[Dict[str, Any]]) -> int:
    if not articles:
        return 0

    seen_headlines = set()
    unique_articles = []
    for article in articles:
        norm_headline = re.sub(r'[^\w\s]', '', article['headline']).lower().strip()
        if norm_headline not in seen_headlines:
            seen_headlines.add(norm_headline)
            unique_articles.append(article)
    articles = unique_articles
    print(f"[Deduplication] Filtered to {len(articles)} unique headlines.")

    conn = get_db_connection()
    insert_sql = """
        INSERT INTO news_sentiment (
            ticker, published_at, headline, sentiment_label, signed_score, source_url, 
            impact_assessment, created_at
        )
        VALUES %s
        ON CONFLICT (ticker, headline) 
        DO UPDATE SET
            sentiment_label = EXCLUDED.sentiment_label,
            signed_score = EXCLUDED.signed_score,
            impact_assessment = EXCLUDED.impact_assessment
        RETURNING id;
    """

    rows = [
        (
            a["ticker"],
            a["published_at"],
            a["headline"],
            a["sentiment_label"],
            a["signed_score"],
            a["source_url"],
            a["impact_assessment"],
            datetime.datetime.now(datetime.timezone.utc)
        )
        for a in articles
    ]

    inserted_count = 0
    with conn.cursor() as cur:
        execute_values(cur, insert_sql, rows)
        inserted_count = cur.rowcount
    conn.commit()
    conn.close()

    return inserted_count

def run_pipeline_for_ticker(ticker: str):
    print(f"\n==========================================")
    print(f"Starting Sentiment Analysis for: {ticker}")
    print(f"==========================================")

    raw_articles = fetch_ticker_news(ticker)
    print(f"[Fetch] Total articles retrieved: {len(raw_articles)}")

    filtered_articles = [a for a in raw_articles if passes_entity_filter(a["headline"], ticker)]
    print(f"[Entity Filter] Passed: {len(filtered_articles)} / {len(raw_articles)} articles.")

    if not filtered_articles:
        print("[Status] No entity-matched articles to process.")
        return

    analyzed = analyze_sentiment(filtered_articles)
    saved_count = save_to_database(analyzed)
    print(f"[Database] Successfully upserted {saved_count} records to news_sentiment table.\n")

def main():
    parser = argparse.ArgumentParser(description="MarketPulse FinBERT Sentiment Worker")
    parser.add_argument("--ticker", type=str, default="RELIANCE.NS", help="Target ticker symbol")
    args = parser.parse_args()
    run_pipeline_for_ticker(args.ticker)

if __name__ == "__main__":
    main()