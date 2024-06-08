// ======================================================================
// Ovipets API
// ======================================================================

class OviPostModule {
    constructor(name, buttonText, clickHandler) {
        this.name = name;
        this.buttonText = buttonText;
        this.clickHandler = clickHandler;

        $(document).ready(() => {
            this.render();
        });
    }

    render() {
        const buttonId = `btn${this.name}`;
        $("#scriptMenu").append(`<li><input type="button" value="${this.buttonText}" id="${buttonId}"/></li>`);
        const button = $(`#${buttonId}`);

        button.on('click', () => {
            button.css('background-color', 'lime');
            this.clickHandler(() => {
                button.css('background-color', '');
            });
        });
    }
}


class CaptchaSolver {
    constructor(species, answer) {
        this.species = species;
        this.answer = answer;
    }
}

const speciesList = ["Canis", "Draconis", "Equus", "Feline", "Gekko", "Lupus", "Mantis", "Raptor", "Slime", "Vulpes"];

const captchaCodes = [
    new CaptchaSolver("Canis", 23),
    new CaptchaSolver("Draconis", 3),
    new CaptchaSolver("Equus", 21),
    new CaptchaSolver("Feline", 2),
    new CaptchaSolver("Gekko", 15),
    new CaptchaSolver("Lupus", 6),
    new CaptchaSolver("Mantis", 37),
    new CaptchaSolver("Raptor", 30),
    new CaptchaSolver("Slime", 35),
    new CaptchaSolver("Vulpes", 19)
];

async function findCaptchaById(dbHandler, id) {
    return await dbHandler.read(id);
}

function setStatus(newStatus) {
    $("#statusText")[0].innerHTML = "Status: " + newStatus;
}

function getUserID() {
    return $($('.links')[0]).find('a')[0].href.split('usr=').pop();
}

async function getFriendList() {
    var friends = [];
    var ownID = getUserID();
    for (let page = 1; page < 10; page++) {
        const response = await sendGet("src=events&sub=feed&sec=friends&page=" + page); //&filter=all&Filter=all <- ah yes, makes perfect sense. When we want to see all friends, we filter 'all'. when we want to filter out only favorites, we do not add a filter
        response.split('usr=').forEach(function (friend) {
            friend = friend.split('&amp').shift().split('\\').shift();
            if (friend.length <= 20 && friend !== ownID && !friends.includes(friend)) {
                friends.push(friend);
            }
        });
        console.log('page: ' + page + ' friends: ' + friends.length);
    }

    // Randomize the friends array
    for (let i = friends.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [friends[i], friends[j]] = [friends[j], friends[i]];
    }

    return friends;
}

// Name unnamed pet
function namePet(PetID, Name) {
    PostQueue.push({
        url: 'https://ovipets.com/cmd.php',
        body: {
            'cmd': 'pet_name',
            'PetID': PetID,
            'Name': Name
        },
        meta: PetID
    });
}

function addEnclosure(Label) {
    PostQueue.push({
        url: 'https://ovipets.com/cmd.php',
        body: {
            'cmd': 'enclosure_add',
            'Presentation': '',
            'Label': Label
        },
        meta: "enclosure_add"
    });
}

// Name named pet
function renamePet(PetID, Name) {
    console.log("renaming: " + PetID + " " + Name);
    PostQueue.push({
        url: 'https://ovipets.com/cmd.php',
        body: {
            'cmd': 'pet_rename',
            'PetID': PetID,
            'Name': Name
        },
        meta: PetID
    });
}

function feedPet(PetID) {
    PostQueue.push({
        url: 'https://ovipets.com/cmd.php',
        body: {
            'cmd': 'pet_feed',
            'PetID': PetID
        },
        meta: "pet_feed"
    });
}

function breedPets(MPetID, FPetID) {
    PostQueue.push({
        url: 'https://ovipets.com/cmd.php',
        body: {
            'cmd': 'pet_breed',
            'MPetID': MPetID,
            'FPetID': FPetID
        },
        meta: 'pet_breed'
    });
}

function addPetDescription(PetID, Text) {
    PostQueue.push({
        url: 'https://ovipets.com/cmd.php',
        body: {
            'cmd': 'pet_presentation',
            'PetID': PetID,
            'Presentation': Text
        },
        meta: 'pet_presentation'
    });
}

// Turn egg or hatch pet
function turnEgg(PetID, meta = null, answer = false) {
    var newElement = {
        url: 'https://ovipets.com/cmd.php',
        body: {
            'cmd': 'pet_turn_egg',
            'PetID': PetID
        },
        meta: meta
    };

    if (answer) {
        newElement.body.Answer = answer;
        PostQueue.unshift(newElement);
    } else {
        PostQueue.push(newElement);
    }
}

async function turnCaptchaEgg(PetID, meta = null) {
    const data = await sendGet("src=pets&sub=profile&pet=" + PetID);
    let json = data.substring(data.indexOf('{'), data.lastIndexOf('}') + 1);
    let userID = getUserIDFromJSON(json);
    var jsonObject = JSON.parse(json);
    var htmlString = jsonObject.output;

    let startIndex = htmlString.indexOf("Solve the following to earn");
    let subString;

    if (startIndex !== -1) {
        subString = htmlString.substring(startIndex);
    } else {
        console.log("Couldn't find 'Solve the following to earn' phrase");
        return;
    }

    let creditsRegex = /title\s*=\s*\\'(\d+)\s*Credit/g;
    let creditsMatch = creditsRegex.exec(subString);
    let credits = 0;

    if (creditsMatch && creditsMatch[1]) {
        credits = parseInt(creditsMatch[1]);
        creditsEarned += credits;

        var elapsedTime = (Date.now() - startTime) / 60000;
        var creditsPerMinute = (creditsEarned / elapsedTime).toFixed(2);

        $("#creditsGainedCounter")[0].innerHTML = "Credits Gained: " + creditsEarned + " (" + creditsPerMinute + " c/m)";
    }

    var regex = /img src = \\&quot;(.*?)\\&quot; title = \\&quot;Name the Species/g;
    var match = regex.exec(htmlString);
    var imageUrl;

    if (match && match[1]) {
        imageUrl = "https:" + match[1].replace(/\\&quot;/g, '"').replace(/&amp;amp;/g, '&');
    }

    if (imageUrl) {
        var modifiedRegex = /modified=(\d+)/;
        var modifiedMatch = modifiedRegex.exec(imageUrl);

        if (modifiedMatch && modifiedMatch[1]) {
            let modifiedValue = modifiedMatch[1];

            if (!modifiedValue) {
                console.log("Couldn't find modified value in: " + modifiedMatch);
            }

            const dbHandler = new DatabaseHandler('CaptchaDB', 'CaptchaStore');
            await dbHandler.openDatabase();
            const captcha = await findCaptchaById(dbHandler, modifiedValue);

            if (!captcha) {
                console.log("Modified value [" + modifiedValue + "] is not known");
                console.log("Error, URL: " + "https://ovipets.com/#!/?src=pets&sub=profile&pet=" + PetID);
                console.log("image: " + imageUrl);

                const species = await getSpeciesFromUser(imageUrl);
                await dbHandler.write(modifiedValue, new CaptchaSolver(species, captchaCodes.find(c => c.species === species).answer));
                alert("New species ID stored: " + species + " with ID: " + modifiedValue);
            } else {
                let answer = captcha.answer;
                let species = captcha.species;

                if (answer && species) {
                    console.log('--Question PetID: ' + PetID + ' Species: ' + species + " modifiedID: " + modifiedValue + " Answer Value: " + answer + " Credits: " + credits + " Total Credits Earned: " + creditsEarned);
                    addToUserCredits(userID, credits);
                    turnEgg(PetID, meta, answer);
                    let creditsOnPage = getCurrentCredits();
                    updateCredits(creditsOnPage + credits);
                } else {
                    alert("Couldn't solve captcha. PetID: " + PetID + " Species: " + species + " answer: " + answer + " modifiedID: " + modifiedValue);
                    console.log("--Couldn't solve captcha. PetID: " + PetID + " Species: " + species + " answer: " + answer + " modifiedID: " + modifiedValue);
                }
            }
        }
    } else {
        console.log("Couldn't find question");
    }
}

// Called when unknown modified ID is found, this prompts the user to solve the captcha.
async function getSpeciesFromUser(imageUrl) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        modal.style.display = 'flex';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.zIndex = '1000';

        const content = document.createElement('div');
        content.style.backgroundColor = 'white';
        content.style.padding = '20px';
        content.style.borderRadius = '10px';
        content.style.textAlign = 'center';

        const img = document.createElement('img');
        img.src = imageUrl;
        img.style.maxWidth = '100%';
        img.style.marginBottom = '20px';

        const prompt = document.createElement('p');
        prompt.textContent = 'Select the species for this image:';

        content.appendChild(img);
        content.appendChild(prompt);

        speciesList.forEach(species => {
            const button = document.createElement('button');
            button.textContent = species;
            button.style.margin = '5px';
            button.onclick = () => {
                document.body.removeChild(modal);
                resolve(species);
            };
            content.appendChild(button);
        });

        modal.appendChild(content);
        document.body.appendChild(modal);
    });
}

function sendPetToAdoptionCenter(PetID) {
    PostQueue.push({
        url: 'https://ovipets.com/cmd.php',
        body: {
            'cmd': 'pet_sendto',
            'PetID': PetID,
            'SendTo': 'adoption_center'
        },
        meta: PetID
    });
}

function sendPetToEnclosure(PetID, Enclosure) {
    PostQueue.push({
        url: 'https://ovipets.com/cmd.php',
        body: {
            'cmd': 'pets_enclosure',
            'PetID': PetID,
            'Enclosure': Enclosure
        },
        meta: PetID
    });
}

function tagPet(PetID, TagID, Text) {
    PostQueue.push({
        url: 'https://ovipets.com/cmd.php',
        body: {
            'cmd': 'pets_tag',
            'PetID': PetID,
            'Tag': TagID,
            'Text': Text
        },
        meta: PetID
    });
}

function sendFriendRequest(userID) {
    PostQueue.push({
        url: 'https://ovipets.com/cmd.php',
        body: {
            'cmd': 'friend_request',
            'UserID': userID
        },
        meta: userID
    });
}


function acceptAllFriendRequests() {
    PostQueue.push({
        url: 'https://ovipets.com/cmd.php',
        body: {
            'cmd': 'friend_requests',
            'Action': 'accept',
            'Filter': 'requests'
        },
        meta: 'accept friend_requests'
    });
}



async function sendPost(url, body, meta = null) {
    $("#postQueue")[0].innerHTML = "Post Queue: " + PostQueue.length;

    const params = new URLSearchParams();
    for (const property in body) {
        params.append(property, body[property]);
    }
    params.append('!', ''); // Add specific query parameter

    const fullUrl = url + '?' + params.toString();

    const formData = new FormData();
    for (const property in body) {
        formData.append(property, body[property]);
    }

    const response = await fetch(fullUrl, {
        method: 'POST',
        body: formData,
    });

    const text = await response.text();
    return { 'res': text, 'meta': meta };
}

async function sendGet(params) {

    while ((Date.now() - LastGet) < postDelay) {
        await new Promise(r => setTimeout(r, 50));
    }
    LastGet = Date.now();

    const response = await fetch('https://ovipets.com/?' + params + "&_=1687772471015&!=jQuery360032008126278894555_1687773018994", {
        method: 'GET',
        headers: {
            'Accept': 'text/javascript, application/javascript, application/ecmascript, application/x-ecmascript, */*; q=0.01'
        }
    });

    var responseText = await response.text();
    return responseText;
}

// ======================================================================
// Post Queue
// ======================================================================
var PostQueue = [];
var successCount = 0; //number of successfull requests
var failedCount = 0; //number of failed requests
let postQueueInterval;

//Sends the server requests and handles API limiting
function startPostQueue() {
    postQueueInterval = setInterval(function () {
        if (PostQueue.length > 0) {
            var request = PostQueue.shift();
            sendPost(request.url, request.body, request.meta)
                .then(response => handlePostResponse(response, request));
        }
    }, postDelay);
}

function updatePostDelay(newDelay) {
    postDelay = newDelay;
    clearInterval(postQueueInterval);
    startPostQueue();
}

function handlePostResponse(response, request) {
    if (response.meta != null) {
        if (response.res.includes('failed')) {
            try {
                // Remove leading and trailing parentheses if they exist
                var cleanedResponse = response.res;
                if (cleanedResponse.startsWith('(') && cleanedResponse.endsWith(')')) {
                    cleanedResponse = cleanedResponse.slice(1, -1);
                }

                var parsedResponse = JSON.parse(cleanedResponse);
                if (parsedResponse.message) {
                    if (parsedResponse.message.includes('The answer is incorrect')) {
                        turnCaptchaEgg(request.body.PetID);
                    } else if(!parsedResponse.message.toLowerCase().includes("you can't turn the egg at this time") && !parsedResponse.message.toLowerCase().includes("only the owner can hatch")){
                        displayErrorMessage(JSON.stringify(request.body) + " => " + parsedResponse.message);
                    }
                }
            } catch (e) {
                console.error('Error parsing response:', e);
                // Optionally display the original response or a generic error message
                displayErrorMessage(response.res);
            }
        } else if (response.res.includes('success')) {
            successCount++;
        }
    }
}

//Displays number of request still in queue
function startPostQueueCounter() {
    setInterval(function () {
        if (PostQueue.length == 0) {
            if ($("#postQueue")[0].innerHTML !== "Post Queue: 0") {
                $("#postQueue")[0].innerHTML = "Post Queue: 0";
            }
        }
    }, 1000);
}
