document.addEventListener("DOMContentLoaded", function () {
    const timeleftEle = document.getElementById("timeleft");
    const goBtnEle = document.getElementById("go-btn");
    const brandLogoImg = document.getElementById("brand-logo");
    let intervalId = -1;
    let reward = 0;
    let waiting = false;

    let personalizerCallResult;

    setupActionControls();
    setupContextControls();

    goBtnEle.addEventListener("click", function () {
        getRecommendation().then(result => {
            personalizerCallResult = result;
            updateBasedOnRecommendation(result);
        });
    });

    const articleViewer = document.getElementById("article-viewer");
    articleViewer.addEventListener("load", function () {
        const articleDoc = articleViewer.contentDocument;

        if (articleViewer.contentWindow.location.href.indexOf("rticle/") > -1) {

            if (intervalId >= 0) {
                clearInterval(intervalId);
                intervalId = -1;
            }

            let counter = 20;
            waiting = true;
            reward = 0;
            updateRewardValue(reward);
            clearRewardmessage();

            intervalId = setInterval(function () {
                counter--;
                timeleftEle.setAttribute("value", counter);
                if (counter <= 0) {
                    clearInterval(intervalId);
                    intervalId = -1;
                    sendReward(personalizerCallResult.eventId, reward).then(() => {
                        showRewardMessage(reward);
                    });
                }
            }, 1000);


            const maxScrollPosition = Math.max(articleDoc.body.scrollHeight, articleDoc.body.offsetHeight,
                articleDoc.documentElement.clientHeight, articleDoc.documentElement.scrollHeight, articleDoc.documentElement.offsetHeight)
                - articleViewer.contentWindow.innerHeight;

            articleDoc.addEventListener("scroll", function () {
                const currentPosition = articleViewer.contentWindow.pageYOffset;
                const newReward = parseFloat((currentPosition / maxScrollPosition).toFixed(2));
                if (intervalId >= 0 && reward < newReward) {
                    reward = newReward;
                    updateRewardValue(reward);
                }
            });

            var innerDoc = articleViewer.contentWindow.document;
            var iframeBackBtn = innerDoc.getElementById('iframe-backBtn');

            if (iframeBackBtn != undefined) {
                iframeBackBtn.style.display = "block";
                iframeBackBtn.addEventListener("click", function () {
                    clearInterval(intervalId);
                    intervalId = -1;
                    if (counter > 0) {
                        sendReward(personalizerCallResult.eventId, reward).then(() => {
                            showRewardMessage(reward);
                        });
                    }
                    timeleftEle.setAttribute("value", 0);
                    updateRewardValue(0);
                    clearRewardmessage();
                    counter = 0;
                    articleViewer.contentWindow.history.back();
                });
            }

            brandLogoImg.addEventListener("click", function () {
                if (iframeBackBtn != undefined) {
                    clearInterval(intervalId);
                    intervalId = -1;
                    if (counter > 0) {
                        sendReward(personalizerCallResult.eventId, reward).then(() => {
                            showRewardMessage(reward);
                        });
                    }
                    timeleftEle.setAttribute("value", 0);
                    updateRewardValue(0);
                    clearRewardmessage();
                    counter = 0;
                }
                articleViewer.contentWindow.history.back();
            });
        }
    });
});

let context = {
    weekDay: "workweek",
    profile: "anonymous",
    tournament: "tournament1",
    userAgent: null,
    useTextAnalytics: false
};

let userAgent = {};

function updateRewardValue(value) {
    const percentageValue = Math.round(value * 100);

    const rewardEle = document.getElementById("reward");
    rewardEle.style = `width: ${percentageValue}%;`;
    rewardEle.setAttribute("aria-valuenow", value);
    rewardEle.innerText = `${value}`;
}

function showRewardMessage(reward) {
    const alertContainerEle = document.getElementById('alert-container');
    alertContainerEle.innerHTML = `<div class="alert alert-success col-12" role="alert">
        Reward of <strong>${reward}</strong> was sent to Personalizer
    </div>`;
}

function clearRewardmessage() {
    const alertContainerEle = document.getElementById('alert-container');
    cleanChilds(alertContainerEle);
}

function setupActionControls() {
    const useTextAnalyticsEle = document.getElementById('text-analytics');
    useTextAnalyticsEle.addEventListener('change', (event) => {
        const checkbox = event.target;
        context.useTextAnalytics = !!checkbox.checked;
        getActions(context.useTextAnalytics).then(updateActionsTab);
    });

    getActions(false).then(updateActionsTab);
}

function setupContextControls() {
    const weekDaySelectEle = document.getElementById('weekDay');
    weekDaySelectEle.addEventListener('change', (event) => {
        updateContext(event.target.value);
    });

    const profileSelectEle = document.getElementById('profile');
    profileSelectEle.addEventListener('change', (event) => {
        updateContext(null, event.target.value);
    });

    const tournamentSelectEle = document.getElementById('tournament');
    tournamentSelectEle.addEventListener('change', (event) => {
        updateContext(null, null, event.target.value);
    });

    const UseUserAgentEle = document.getElementById('use-useragent');
    UseUserAgentEle.addEventListener('change', (event) => {
        const checkbox = event.target;
        if (checkbox.checked) {
            updateContext(null, null, null, false, userAgent);
        } else {
            updateContext(null, null, null, true);
        }
    });

    getUserAgent().then(userAgentResponse => {
        userAgent = userAgentResponse;
        updateContext(weekDaySelectEle.value, profileSelectEle.value, tournamentSelectEle.value, !UseUserAgentEle.checked, userAgent);
    });

    updateContext(weekDaySelectEle.value, profileSelectEle.value, tournamentSelectEle.value);
}

function updateContext(weekDay, profile, tournament, removeUserAgent, userAgent) {
    context.weekDay = weekDay || context.weekDay;
    context.profile = profile || context.profile;
    context.tournament = tournament || context.tournament;
    context.userAgent = removeUserAgent ? null : userAgent || context.userAgent;

    let contextFeatures = [
        {
            weekDay: context.weekDay,
            profile: context.profile
        },
        { tournament: context.tournament }
    ];


    if (context.userAgent) {
        contextFeatures.push({ userAgent: context.userAgent });
    }

    updateCodeElementWithJSON("context-code", { contextFeatures: contextFeatures });
}

function updateBasedOnRecommendation(result) {
    showResultContainer();
    updateArticle(result);
    updateResult(result);
    updatePersonalizerMethod(result);
}

function showResultContainer() {
    const resultContainerEle = document.getElementById("result-section");
    resultContainerEle.classList.remove("d-none");
}

function updatePersonalizerMethod(recommendation) {
    const exploringBoxEle = document.getElementById("exploring-box");
    const exploitingBoxEle = document.getElementById("exploiting-box");

    if (isExploiting(recommendation)) {
        exploitingBoxEle.className = 'card border-left border-primary';
        exploringBoxEle.className = 'card';
    } else {
        exploringBoxEle.className = 'card border-primary';
        exploitingBoxEle.className = 'card';
    }
}

function isExploiting(recommendation) {
    const rewardActionId = recommendation.rewardActionId;
    const ranking = recommendation.ranking;

    let max = Math.max.apply(Math, recommendation.ranking.map((r) => { return r.probability; }));

    for (var i = 0; i < ranking.length; i++) {
        if (ranking[i].id === rewardActionId) {
            return ranking[i].probability === max;
        }
    }
}

function updateResult(result) {
    updateCodeElementWithJSON("result-code", { result: result }, result.rewardActionId);
}

function updateCodeElementWithJSON(eleId, jsonObj, resultId) {
    const codeEle = document.getElementById(eleId);
    let code = JSON.stringify(jsonObj, null, 2);

    if (resultId) {
        const regex = new RegExp(`(.*)("rewardActionId":\\s"${resultId}"\\n)(.*)`, 'gm');
        code = code.replace(regex, '$1<mark>$2</mark>$3');
    }

    codeEle.innerHTML = code;
}

function updateActionsTab(actions) {
    const actionsHeaderTab = document.getElementById("actions-tab");
    const actionsTabContent = document.getElementById("actions-tabContent");

    cleanChilds(actionsHeaderTab);
    cleanChilds(actionsTabContent);

    let actionsTabHeadersString = "";
    let actionsTabContentString = "";

    for (var i = 0; i < actions.length; i++) {
        let actionTabContent = createActionTab(actions[i], i === 0);
        actionsTabHeadersString += actionTabContent.tabHeader;
        actionsTabContentString += actionTabContent.tabContent;
    }

    actionsHeaderTab.innerHTML = actionsTabHeadersString;
    actionsTabContent.innerHTML = actionsTabContentString;
}

function createActionTab(actionObj, active) {
    let action = {};
    for (var attr in actionObj) {
        if (actionObj.hasOwnProperty(attr) && attr !== "title" && attr !== "imageName") action[attr] = actionObj[attr];
    }

    return {
        tabHeader: `<a class="nav-link d-flex align-items-center${active ? " active" : ""}" id="${actionObj.id}-article-tab" data-toggle="pill" href="#${actionObj.id}-article" role="tab" aria-controls="${actionObj}-article" aria-selected="${active ? "true" : "false"}"> ${actionObj.id}
                        <div class="mx-auto"></div>
                        <img class="rounded img-fluid" alt="Preview thumbnail for ${actionObj.title}" src="img/${actionObj.imageName}" style="max-width:4rem;"></img>
                    </a>`,
        tabContent: `<div class="tab-pane fade ${active ? "show active" : ""}" role="tabpanel" id="${actionObj.id}-article" role="tabpanel" aria-labelledby="${actionObj.id}-article-tab">
                        <p class="h6 p-1 pt-2"><strong>Title:</strong> ${actionObj.title}</p>
                        <pre class="pre-scrollable border m-0"><code>${JSON.stringify(action, null, 2)}</code></pre>
                    </div>`
    };
}

function updateArticle(result) {
    let articleIds = result.ranking.map(function (ranking) {
        return ranking.id;
    }).join(",");
    const articleViewer = document.getElementById("article-viewer");
    articleViewer.src = `/home/homesite?articleIds=${articleIds}`;
}

function getActions(useTextAnalytics) {
    return fetch(`/api/Metadata/Actions?useTextAnalytics=${useTextAnalytics}`).then(r => r.json());
}

function getRecommendation() {
    const requestContext = {
        weekDay: context.weekDay,
        profile: context.profile,
        tournament: context.tournament,
        useTextAnalytics: context.useTextAnalytics,
        useUserAgent: !!context.userAgent
    };

    return fetch("/api/Personalizer/Recommendation", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(requestContext)
    }).then(r => r.json());
}

function getUserAgent() {
    return fetch("/api/Metadata/UserAgent").then(r => r.json());
}

function sendReward(eventid, value) {
    return fetch("/api/Personalizer/Reward", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            eventid: eventid,
            value: value
        })
    });
}
