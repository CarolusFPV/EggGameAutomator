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
                // Callback to reset the background color after clickHandler is done
                button.css('background-color', '');
            });
        });
    }
}


class CaptchaSolver {
    constructor(id, species, answer) {
        this.id = id;
        this.species = species;
        this.answer = answer;
    }
}

const captchaCodes = [
    new CaptchaSolver("1702424664", "Canis", 23),
    new CaptchaSolver("1614919856", "Draconis", 3),
    new CaptchaSolver("1701390206", "Equus", 21),
    new CaptchaSolver("1696153656", "Feline", 2),
    new CaptchaSolver("1688169852", "Gekko", 15),
    new CaptchaSolver("1701390507", "Lupus", 6),
    new CaptchaSolver("1682925936", "Mantis", 37),
    new CaptchaSolver("1701390338", "Raptor", 30),
    new CaptchaSolver("1701390267", "Slime", 35),
    new CaptchaSolver("1702424735", "Vulpes", 19)
];

function findCaptchaById(id) {
    return captchaCodes.find((captcha) => captcha.id === id);
}

function setStatus(newStatus) {
    $("#statusText")[0].innerHTML = "Status: " + newStatus;
}

function getUserID() {
    return $($('.links')[0]).find('a')[0].href.split('usr=').pop();
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

    // Find the index where "Solve the following to earn" starts
    let startIndex = htmlString.indexOf("Solve the following to earn");
    let subString;

    // If the phrase is found, create a substring starting from that phrase
    if (startIndex !== -1) {
        subString = htmlString.substring(startIndex);
    } else {
        console.log("Couldn't find 'Solve the following to earn' phrase");
        return;
    }

    // Use regex to find the title attribute with credits
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

    // Use regex to find the img src within the action attribute
    var regex = /img src = \\&quot;(.*?)\\&quot; title = \\&quot;Name the Species/g;
    var match = regex.exec(htmlString);
    var imageUrl;

    if (match && match[1]) {
        imageUrl = match[1].replace(/\\&quot;/g, '"');
    }

    if (imageUrl) {

        // Use regex to find the modified value
        var modifiedRegex = /modified=(\d+)/;
        var modifiedMatch = modifiedRegex.exec(imageUrl);

        if (modifiedMatch && modifiedMatch[1]) {
            let modifiedValue = modifiedMatch[1];

            if (!modifiedValue) {
                console.log("Couldn't find modified value in: " + modifiedMatch);
            }

            const captcha = findCaptchaById(modifiedValue);

            //Show in console if modified value is unknown.
            if (!captcha) {
                console.log("Modified value [" + modifiedValue + "] is not known")
                console.log("Error, URL: " + "https://ovipets.com/#!/?src=pets&sub=profile&pet=" + PetID)
                return;
            }

            let answer = captcha.answer;
            let species = captcha.species

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
    } else {
        console.log("Couldn't find question");
    }
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
    params.append('!jQuery360012094249696657289_1687776334529', ''); // Add specific query parameter

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
                    } else {
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
