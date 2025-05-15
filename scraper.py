import requests
from bs4 import BeautifulSoup
import pandas as pd

sitemap_url = "https://www.seattleu.edu/sitemap.xml"
response = requests.get(sitemap_url)
soup = BeautifulSoup(response.content, "xml")
urls = [loc.text for loc in soup.find_all("loc")]
print(f"Found {len(urls)} URLs in the sitemap.")
#first 5 urls
print("First 5 URLs:")
for url in urls[:10]:
    print(url)
    
df = pd.DataFrame(urls, columns=["URL"])
# Save to CSV
df.to_csv("sitemap_urls.csv", index=False)