import os
from crewai import LLM
from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from tools.spotify_recommendation_tool import SpotifyRecommendationTool

@CrewBase
class EnterpriseAiMusicRecommendationSystemCrew:
    """EnterpriseAiMusicRecommendationSystem crew"""

    @agent
    def natural_language_interpreter(self) -> Agent:
        return Agent(
            config=self.agents_config["natural_language_interpreter"],
            tools=[],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            max_execution_time=None,
            llm=LLM(model="google/gemini-2.0-flash"),
        )

    @agent
    def emotional_intelligence_analyst(self) -> Agent:
        return Agent(
            config=self.agents_config["emotional_intelligence_analyst"],
            tools=[],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            max_execution_time=None,
            llm=LLM(model="google/gemini-2.0-flash"),
        )

    @agent
    def music_feature_translator(self) -> Agent:
        return Agent(
            config=self.agents_config["music_feature_translator"],
            tools=[],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            max_execution_time=None,
            llm=LLM(model="google/gemini-2.0-flash"),
        )

    @agent
    def music_data_fetcher(self) -> Agent:
        return Agent(
            config=self.agents_config["music_data_fetcher"],
            tools=[SpotifyRecommendationTool()],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            max_execution_time=None,
            llm=LLM(model="google/gemini-2.0-flash"),
        )

    @agent
    def recommendation_engine(self) -> Agent:
        return Agent(
            config=self.agents_config["recommendation_engine"],
            tools=[],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            max_execution_time=None,
            llm=LLM(model="groq/llama-3.3-70b-versatile"),
        )

    @agent
    def music_curator(self) -> Agent:
        return Agent(
            config=self.agents_config["music_curator"],
            tools=[],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            max_execution_time=None,
            llm=LLM(model="groq/llama-3.3-70b-versatile"),
        )

    @agent
    def explainability_expert(self) -> Agent:
        return Agent(
            config=self.agents_config["explainability_expert"],
            tools=[],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            max_execution_time=None,
            llm=LLM(model="groq/llama-3.3-70b-versatile"),
        )

    @agent
    def evaluation_engine(self) -> Agent:
        return Agent(
            config=self.agents_config["evaluation_engine"],
            tools=[],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            max_execution_time=None,
            llm=LLM(model="groq/llama-3.3-70b-versatile"),
        )

    @agent
    def music_recommendation_report_generator(self) -> Agent:
        return Agent(
            config=self.agents_config["music_recommendation_report_generator"],
            tools=[],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            max_execution_time=None,
            llm=LLM(model="groq/llama-3.3-70b-versatile"),
        )

    @agent
    def data_analyst(self) -> Agent:
        return Agent(
            config=self.agents_config["data_analyst"],
            tools=[],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            max_execution_time=None,
            llm=LLM(model="groq/llama-3.3-70b-versatile"),
        )

    @agent
    def quality_control_specialist(self) -> Agent:
        return Agent(
            config=self.agents_config["quality_control_specialist"],
            tools=[],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            max_execution_time=None,
            llm=LLM(model="groq/llama-3.3-70b-versatile"),
        )

    @agent
    def feedback_learning_agent(self) -> Agent:
        return Agent(
            config=self.agents_config["feedback_learning_agent"],
            tools=[],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            max_execution_time=None,
            llm=LLM(model="groq/llama-3.3-70b-versatile"),
        )

    @agent
    def config_manager(self) -> Agent:
        return Agent(
            config=self.agents_config["config_manager"],
            tools=[],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            max_execution_time=None,
            llm=LLM(model="google/gemini-2.0-flash"),
        )

    @agent
    def stability_controller(self) -> Agent:
        return Agent(
            config=self.agents_config["stability_controller"],
            tools=[],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            max_execution_time=None,
            llm=LLM(model="groq/llama-3.3-70b-versatile"),
        )

    @agent
    def audit_logger(self) -> Agent:
        return Agent(
            config=self.agents_config["audit_logger"],
            tools=[],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            max_execution_time=None,
            llm=LLM(model="google/gemini-2.0-flash"),
        )

    @task
    def parse_music_request_intent(self) -> Task:
        return Task(
            config=self.tasks_config["parse_music_request_intent"],
            markdown=False,
        )

    @task
    def initialize_system_config(self) -> Task:
        return Task(
            config=self.tasks_config["initialize_system_config"],
            markdown=False,
        )

    @task
    def analyze_emotional_context(self) -> Task:
        return Task(
            config=self.tasks_config["analyze_emotional_context"],
            markdown=False,
        )

    @task
    def map_audio_features(self) -> Task:
        return Task(
            config=self.tasks_config["map_audio_features"],
            markdown=False,
        )

    @task
    def retrieve_real_songs(self) -> Task:
        return Task(
            config=self.tasks_config["retrieve_real_songs"],
            markdown=False,
        )

    @task
    def score_song_match_quality(self) -> Task:
        return Task(
            config=self.tasks_config["score_song_match_quality"],
            markdown=False,
        )

    @task
    def create_coherent_playlist(self) -> Task:
        return Task(
            config=self.tasks_config["create_coherent_playlist"],
            markdown=False,
        )

    @task
    def validate_playlist_quality(self) -> Task:
        return Task(
            config=self.tasks_config["validate_playlist_quality"],
            markdown=False,
        )

    @task
    def explain_song_selection(self) -> Task:
        return Task(
            config=self.tasks_config["explain_song_selection"],
            markdown=False,
        )

    @task
    def generate_playlist_analytics(self) -> Task:
        return Task(
            config=self.tasks_config["generate_playlist_analytics"],
            markdown=False,
        )

    @task
    def calculate_playlist_score(self) -> Task:
        return Task(
            config=self.tasks_config["calculate_playlist_score"],
            markdown=False,
        )

    @task
    def analyze_performance_and_learn(self) -> Task:
        return Task(
            config=self.tasks_config["analyze_performance_and_learn"],
            markdown=False,
        )

    @task
    def validate_config_stability(self) -> Task:
        return Task(
            config=self.tasks_config["validate_config_stability"],
            markdown=False,
        )

    @task
    def log_parameter_changes(self) -> Task:
        return Task(
            config=self.tasks_config["log_parameter_changes"],
            markdown=False,
        )

    @task
    def store_updated_config(self) -> Task:
        return Task(
            config=self.tasks_config["store_updated_config"],
            markdown=False,
        )

    @task
    def generate_final_report(self) -> Task:
        return Task(
            config=self.tasks_config["generate_final_report"],
            markdown=False,
        )

    @crew
    def crew(self) -> Crew:
        """Creates the EnterpriseAiMusicRecommendationSystem crew"""
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=True,
            chat_llm=LLM(model="groq/llama-3.3-70b-versatile"),
        )
