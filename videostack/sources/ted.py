
import urllib2
from BeautifulSoup import BeautifulSoup

def get_video(url):
    d = urllib2.urlopen(url)
    page = d.read()
    soup = BeautifulSoup(page)
    for link in soup.findAll("a"):
        if link["href"].startswith("/talks/download/video") and link.contents[0].find("high-res") != -1:
            return "http://www.ted.com" + link["href"]
    return None

def get_talk_list(page):
    url = "http://www.ted.com/talks/list/page/%d" % page
    d = urllib2.urlopen(url)
    page = d.read()
    soup = BeautifulSoup(page)

    for link in soup.findAll('a'):
        table = dict(link.attrs)
        if "href" in table and table["href"].startswith("/talks") and table["href"].endswith(".html"):
            for img in link.findAll("img"):
                if img["src"].startswith("http://images.ted.com"):
                    complete = "http://www.ted.com" + table["href"]
                    item = dict(title=link["title"], thumb = img["src"], link = complete, video = get_video(complete))
                    yield item

items = []

for i in range(1,49):
    for item in get_talk_list(i):
        print item
        items.append(item)

try:
	import simplejson as json
except:
	import json

file("talks.txt", "w").write(json.dumps(items))