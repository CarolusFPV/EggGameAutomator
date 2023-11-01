// ==UserScript==
// @name         OviPost 2
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Skip pressing buttons, straight up use post requests to handle actions.
// @author       CarolusFPV
// @match        https://ovipets.com/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=ovipets.com
// @grant        GM_notification
// @grant        GM_addStyle
// ==/UserScript==

console.log("Ovi Script Loaded");

//Settings
const postDelay = 500;

//Globar variables
var creditsEarned = 0;
var startTime;
var LastGet = Date.now();

class OviPostModule {
    constructor(name, buttonText, clickHandler) {
        this.name = name;
        this.buttonText = buttonText;
        this.clickHandler = clickHandler;
    }

    render() {
        const buttonId = `btn${this.name}`;
        $("#scriptMenu").append(`<li><input type="button" value="${this.buttonText}" id="${buttonId}"/></li>`);
        $(`#${buttonId}`).click(this.clickHandler);
    }
}


// ======================================================================
// Script Modules
// ======================================================================

//This module is used to automatically mass turn eggs for all your friends.
class TurnEggsModule extends OviPostModule {
    constructor() {
        super('TurnEggs', 'Turn Eggs', async () => {
            creditsEarned = 0;
            startTime = Date.now()
            const friends = await this.getFriendList();
            var eggCounter = 0;
            var friendCounter = 0;
            var totalFriends = friends.length;
            while (friends.length > 0) {
                while (PostQueue.length > 0) {
                    await new Promise(r => setTimeout(r, 50));
                }
                var friend = friends.pop();
                friendCounter++;
                var eggs = await this.getEggs(friend);
                eggCounter += eggs.length;
                setStatus("Turning Eggs (" + friend + ")");
                eggs.forEach(function(egg) {
                    turnEgg(egg, friend);
                });
            }
            setStatus("idle");
        });
    }

    async getFriendList() {
        var friends = [];
        var ownID = getUserID();
        for (let page = 1; page < 20; page++) {
            const response = await sendGet("src=events&sub=feed&sec=friends&filter=all&Filter=all&page=" + page);
            response.split('usr=').forEach(function(friend) {
                friend = friend.split('&amp').shift().split('\\').shift();
                if (friend.length <= 20 && friend !== ownID && !friends.includes(friend)) {
                    friends.push(friend);
                }
            });
            console.log('page: ' + page + ' friends: ' + friends.length);
            if (response.includes('label = \\\"Previous')) {
                break;
            }
        }
        return friends;
    }

    async getEggs(userID) {
        console.log("Get Eggs: " + userID);
        const response = await sendGet("src=pets&sub=hatchery&usr=" + userID);
        var eggs = [];
        response.split('Turn Egg').forEach(function(egg) {
            if (!(egg.includes('to avoid') || egg.includes('exectime'))) {
                egg = egg.split('pet=').pop().split('&').shift();
                if (egg.length <= 10) {
                    eggs.push(egg);
                }
            }
        });
        return eggs;
    }
}
const turnEggsModule = new TurnEggsModule();

class HatchEggsModule extends OviPostModule {
    constructor() {
        super('HatchEggs', 'Hatch Eggs', async () => {
            const eggs = await this.getReadyToHatch();

            eggs.forEach(function(egg) {
                turnEgg(egg);
            });
        });
    }

    async getReadyToHatch() {
        const response = await sendGet("src=pets&sub=hatchery&usr=" + getUserID());

        const eggs = [];
        response.split('Hatch Egg').forEach(function(egg) {
            egg = egg.split('pet=').pop().split('&').shift();
            if (egg.length <= 10) {
                eggs.push(egg);
            }
        });

        return eggs;
    }
}
const hatchEggsModule = new HatchEggsModule();

class MassNameModule extends OviPostModule {
    constructor() {
        super('MassName', 'Mass Name (Selected)', () => {
            var name = prompt("Name:");

            var pets = [];
            if (document.URL.includes('sub=overview')) {
                getSelectedPets().each(function() {
                    var petName = $(this).attr('title');
                    if (petName != name) {
                        pets.push($(this).attr('href').split('pet=').pop());
                    }
                });

                if (pets) {
                    while (pets.length > 0) {
                        setStatus("Renaming Pets");
                        renamePet(pets.shift(), name);
                    }
                    setStatus("idle");
                } else {
                    alert("No pets found.");
                }
            } else if (document.URL.includes('sub=hatchery')) {
                $('img[width=120]').each(function() {
                    pets.push($(this).attr('src').split('pet=').pop().split('&modified').shift());
                });

                if (pets) {
                    while (pets.length > 0) {
                        namePet(pets.shift(), name);
                    }
                } else {
                    alert("No eggs found.");
                }
            }
        });
    }
}
const massNameModule = new MassNameModule();

//Get tatoo data
setInterval(function(){
    var updateButton = $("button:contains('Update'):not(.event-attached)");

    if (updateButton.length > 0) {
        console.log("Found button, attaching event.");
        updateButton.addClass("event-attached");

        updateButton.click(function() {
            var onclickValue = $(this).attr("onclick");
            console.log("Button clicked, onclick value:", onclickValue);

            // Fetch the values directly from the input fields within the 'config' fieldset
            var W = $("fieldset.config div.ui-input.txt input[name='W']").val();
            var H = $("fieldset.config div.ui-input.txt input[name='H']").val();
            var X = $("fieldset.config div.ui-input.txt input[name='X']").val();
            var Y = $("fieldset.config div.ui-input.txt input[name='Y']").val();
            var A = $("fieldset.config div.ui-input.txt input[name='A']").val();

            console.log(`${W},${H},${X},${Y},${A}`);
            alert(`${W},${H},${X},${Y},${A}`);
        });
    }
}, 100);

class MassTattooModule extends OviPostModule {
    constructor() {
        super('MassTattoo', 'Mass Tattoo (Selected)', () => {
            // Create a hidden file input element
            var tattooImage = document.createElement('input');
            tattooImage.type = 'file';
            tattooImage.style.display = 'none';
            tattooImage.id = 'tattooImage';
            document.body.appendChild(tattooImage);

            // Prompt user to select an image
            tattooImage.click();

            tattooImage.onchange = async function() {
                var file = tattooImage.files[0];

                // Checking if file is selected
                if (!file) {
                    alert("Please select an image");
                    return;
                }

                // Read the file as binary string
                var binaryData;
                await new Promise((resolve) => {
                    var reader = new FileReader();
                    reader.onloadend = function() {
                        binaryData = reader.result;
                        resolve();
                    }
                    reader.readAsArrayBuffer(file);
                });

                // Convert binary string to Blob
                var blobData = new Blob([binaryData], {type: file.type});

                var pets = [];
                if (document.URL.includes('sub=overview')) {
                    getSelectedPets().each(function() {
                        pets.push($(this).attr('href').split('pet=').pop());
                    });

                    // Ask user for additional parameters before the pet loop
                    var additionalParams = prompt("Please enter CropW, CropH, CropX, CropY, and Opacity, separated by a comma:");
                    var params = additionalParams.split(',');

                    if (pets) {
                        while (pets.length > 0) {
                            let PetID = pets.shift();

                            PostQueue.push({
                                url: 'https://ovipets.com/cmd.php',
                                body: {
                                    'GeneID': '1',
                                    'Tattoo': blobData,
                                    'cmd': 'tattoo_upl',
                                    'PetID': PetID
                                },
                                meta: 'tattoo_upload'
                            });

                            PostQueue.push({
                                url: 'https://ovipets.com/',
                                body: {
                                    'src': 'pets',
                                    'sub': 'profile',
                                    'sec': 'tattoo,pet',
                                    'pet': PetID,
                                    'Tattoo': 'C%3A%5Cfakepath%5CTattoo.png'
                                },
                                meta: 'tattoo_apply'
                            });

                            // Add additional post request to the queue
                            PostQueue.push({
                                url: 'https://ovipets.com/cmd.php',
                                body: {
                                    'cmd': 'tattoo_upd',
                                    'PetID': PetID,
                                    'GeneID': '1',
                                    'W': params[0],
                                    'H': params[1],
                                    'X': params[2],
                                    'Y': params[3],
                                    'A': params[4]
                                },
                                meta: 'tattoo_edit'
                            });
                        }
                    } else {
                        alert("No pets found.");
                    }
                }

                alert("All uploads queued!");
            }
        });
    }
}
const massTattooModule = new MassTattooModule();

class MassDescModule extends OviPostModule {
    constructor() {
        super('MassDesc', 'Mass Desc (Selected)', () => {
            var text = prompt("Description:");

            var pets = [];
            getSelectedPets().each(function() {
                pets.push($(this).attr('href').split('pet=').pop());
            });

            if (pets) {
                while (pets.length > 0) {
                    addPetDescription(pets.shift(), text);
                }
            } else {
                alert("No pets found.");
            }
        });
    }
}
const massDescModule = new MassDescModule();

class FeedPetsModule extends OviPostModule {
  constructor() {
    super('FeedPets', 'Feed Pets', async () => {
      var count = 0;
      $('li.selected').find('a.pet:not(.name)[href*="pet="]').each(function() {
        var href = $(this).attr('href');
        var PetID = href.split("pet=").pop();
        feedPet(PetID);
        count++;
      });
    });
  }
}
const feedPetsModule = new FeedPetsModule();

class MassBreedModule extends OviPostModule {
    constructor() {
        super('MassBreed', 'Mass Breed', () => {
            function getPetIDs() {
                var petIDs = [];
                $('img[class="pet"]').each(function() {
                    var href = $(this).attr('src');
                    if (href) {
                        petIDs.push(href.split("pet=").pop().split("&modified=").shift());
                    }
                });
                return petIDs;
            }

            function getMaleID() {
                if ($('img[title="Female"]').length > 0) {
                    alert("Error, selected pet is a female. You can only mass breed males.");
                    return null;
                }
                return document.URL.split("pet=").pop();
            }

            var maleID = getMaleID();
            if (!maleID) return;

            var petIDs = getPetIDs();
            if (petIDs) {
                while (petIDs.length > 0) {
                    breedPets(maleID, petIDs.shift());
                }
            } else {
                alert("No pets found to breed with, make sure you have an enclosure selected under the Breeding tab.");
            }
        });
    }
}
const massBreedModule = new MassBreedModule();

class TestModule extends OviPostModule {
    constructor() {
        super('Test', 'Test', () => {
            const westernCountryCodes = [
                // Western Europe
                'AT', // Austria
                'BE', // Belgium
                'CH', // Switzerland
                'DE', // Germany
                'DK', // Denmark
                'ES', // Spain
                'FI', // Finland
                'FR', // France
                'GB', // United Kingdom
                'IE', // Ireland
                'IT', // Italy
                'LU', // Luxembourg
                'NL', // Netherlands
                'NO', // Norway
                'PT', // Portugal
                'SE', // Sweden

                // North America
                'CA', // Canada
                'US', // United States

                // South America
                'AR', // Argentina
                'BR', // Brazil
                'CL', // Chile
                'CO', // Colombia
                'EC', // Ecuador
                'PE', // Peru
            ];
            for (const countryCode of westernCountryCodes) {
                addEnclosure(countryCode + " balls");
            }
        });
    }
}

const testModule = new TestModule();

$(document).ready(function() {
    turnEggsModule.render();
    hatchEggsModule.render();
    massNameModule.render();
    massDescModule.render();
    massBreedModule.render();
    feedPetsModule.render();
    massTattooModule.render();
    testModule.render();
});


// ======================================================================
// Post Queue
// ======================================================================
var PostQueue = [];
var successCount = 0; //number of successfull requests
var failedCount = 0; //number of failed requests

//Sends the server requests and handles API limiting
function startPostQueue() {
    setInterval(function() {
        if (PostQueue.length > 0) {
            var request = PostQueue.shift();
            sendPost(request.url, request.body, request.meta)
                .then(response => handlePostResponse(response, request)); // Pass the request as a parameter
        }
    }, postDelay);
}

function handlePostResponse(response, request) {
    if (response.meta != null) {
        if (response.res.includes('failed')) {
            if (response.res.includes('The answer is incorrect')) {
                turnCaptchaEgg(request.body.PetID);
            } else {
                failedCount++;
            }
        } else if (response.res.includes('success')) {
            successCount++;
        }
    }
}


//Displays number of request still in queue
function startPostQueueCounter(){
    setInterval(function() {
        if (PostQueue.length == 0) {
            if ($("#postQueue")[0].innerHTML !== "Post Queue: 0") {
                $("#postQueue")[0].innerHTML = "Post Queue: 0";
            }
        }
    }, 1000);
}



// ======================================================================
// Ovipets API
// ======================================================================

class CaptchaSolver {
    constructor(id, species, answer) {
        this.id = id;
        this.species = species;
        this.answer = answer;
    }
}

const captchaCodes = [
    new CaptchaSolver("1630382962", "Canis", 23),
    new CaptchaSolver("1614919856", "Draconis", 3),
    new CaptchaSolver("1677669920", "Equus", 21),
    new CaptchaSolver("1675234922", "Feline", 2),
    new CaptchaSolver("1688169852", "Gekko", 15),
    new CaptchaSolver("1677671012", "Lupus", 6),
    new CaptchaSolver("1682925936", "Mantis", 37),
    new CaptchaSolver("1682925576", "Raptor", 30),
    new CaptchaSolver("1688175088", "Slime", 35),
    new CaptchaSolver("1669779345", "Vulpes", 19)
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

async function turnCaptchaEgg(PetID, meta = null){
    const data = await sendGet("src=pets&sub=profile&pet=" + PetID);
    let json = data.substring(data.indexOf('{'), data.lastIndexOf('}') + 1);

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

        $("#creditsGainedCounter")[0].innerHTML = "Credits Gained: " + creditsEarned + " ("+ creditsPerMinute + " c/m)";
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

            const captcha = findCaptchaById(modifiedValue);
            let answer = captcha.answer;
            let species = captcha.species

            if(answer && species){
                console.log('--Question PetID: ' + PetID +' Species: ' + species + " modifiedID: " + modifiedValue + " Answer Value: " + answer + " Credits: " + credits + " Total Credits Earned: " + creditsEarned);
                turnEgg(PetID, meta, answer);
            }else{
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

function acceptAllFriendRequests(){
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
// JQuery and Regex (stuff that might change over time..)
// ======================================================================

//Returns a list of PetID's of pets you currently have selected.
function getSelectedPets() {
  return $('li.selected').find('a.pet:not(.name)[href*="pet="]');
}

//Returns a list of PetID's that are currently loaded.
// [WARNING]
//  Every enclosure you open loads the pets to the current session.
//  They will stay loaded during the session, even if you are not currently looking at the enclosure.
//  The only way to unload them is to refresh the page.
//  Best to stay away from using this since it may result into unexpected behaviour.
function getLoadedPetIDs(){
    return $('img[class="pet"]');
}

//Returns the container for the selection buttons that pops up when you select pets
function findSelectNoneButtonContainer() {
    return $('.ui-fieldset-body:visible').find('button:contains("Select None")').closest('.ui-fieldset-body:visible');
}


// ======================================================================
// Front End
// ======================================================================

const ELEMENT_IDS = {
    header: "header",
    menu: "menu",
};

const UI_SETTINGS = {
    sidebarWidth: "180px",
};

// Set the width and position of the html element
$("html").css({
    position: "relative",
    width: `calc(100% - ${UI_SETTINGS.sidebarWidth})`,
});

// Create and append the script menu if it doesn't exist
if (!document.getElementById("scriptMenu")) {
    $("body").append(`
    <div id="gmRightSideBar">
        <ul id="scriptMenu">
          <li><a id="statusText">Status: idle</a></li>
          <li><a id="creditsGainedCounter">Credits Gained: 0</a></li>
          <li><a id="postQueue">Post Queue: 0</a></li>
        </ul>
    </div>
  `);
}

// Add custom styles for the sidebar
GM_addStyle(`
    #gmRightSideBar {
        position: fixed;
        top: 0;
        right: 0;
        margin: 1ex;
        padding: 1em;
        background: orange;
        width: calc(${UI_SETTINGS.sidebarWidth} - 2ex);
    }
    #gmRightSideBar ul {
        margin: 0ex;
    }
    #gmRightSideBar a {
        color: blue;
    }
`);

function addCustomSelectionOptions() {
  var buttonContainer = findSelectNoneButtonContainer();

  if (buttonContainer.length > 0) {
    // Element found, add the button
    addCustomSelectionButtons();
  } else {
    // Element not found, wait and try again
    setTimeout(addCustomSelectionOptions, 100);
  }
}

function addCustomSelectionButtons() {
  console.log("Adding custom selection buttons");
  var selectNoneButton = $('.ui-input.btn button:contains("Select None")');

  var buttonConfigs = [
    {
      text: "Test",
      handler: function() {
        alert("Test button clicked");
      }
    },
    {
      text: "Hide Bred",
      handler: function() {
        // Your logic to hide bred elements here
      }
    }
    // Add more button configurations as needed
  ];

  // Iterate over the button configurations and create the buttons
  buttonConfigs.forEach(function(config) {
    var button = $('<button>').attr('type', 'button').addClass('ui-button ui-corner-all ui-widget').text(config.text);

    // Insert the button next to the Select None button
    selectNoneButton.after(button);

    // Add click event handler for the button
    button.click(config.handler);
  });
}



// ======================================================================
// Initiator
// ======================================================================

function startMacro() {
    startPostQueue();

    startPostQueueCounter();

    addCustomSelectionOptions();
}

startMacro();
