

**I'd evaluate our current repository around 8/10.**

1\) **README covers what's needed.**
The project idea, roles, and features are explained clearly enough that a new person could understand what Ayna does without needing extra context. 
The sprint breakdown is also helpful , it shows not just what's been built, but in what order, which makes the development logic easy to follow.

2\) **Folder structure is straightforward.**
Backend and frontend are separated into their own directories. 
This matters because as more people contribute and the frontend gets added, there's less risk of things getting tangled. 
The internal structure of the backend also follows a clear pattern: models, schemas, services, api which is consistent with how FastAPI projects are typically organized.

3\) **File names match their content.**
This makes navigation easier, especially for someone unfamiliar with the codebase. 
You don't have to open a file to guess what's inside it.

4\) **Essential files for the current stage are present.**
The repo includes a requirements.txt, alembic config,  seed scripts, and a working entry point. 
Everything someone needs to actually run the project locally is there and documented.

5\) **Commit history could be better.**
Sabina handled the backend and commits were pushed closer to the deadline even though things were done earlier. 
This makes it harder to see how the project actually progressed over time, and in a team setting it can obscure individual contributions.
Worth being more consistent with going forward.